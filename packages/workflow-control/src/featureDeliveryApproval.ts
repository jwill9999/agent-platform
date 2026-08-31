import { z } from 'zod';

import {
  deriveFeatureDeliveryIntentMaterialDigest,
  featureDeliveryContractSchema,
  featureDeliveryCriticReviewSchema,
  featureDeliveryRequiredIntentSchema,
  type FeatureDeliveryApproval,
  type FeatureDeliveryContract,
  type FeatureDeliveryCriticReview,
  type FeatureDeliveryRequiredIntent,
} from './featureDeliveryContracts.js';
import {
  workflowFeatureDeliveryApprovalCapability,
  workflowFeatureDeliveryCriticCapability,
  workflowFeatureDeliveryIntentCapability,
  type WorkflowStore,
} from './storage.js';

type FeatureDeliveryIntentDecision = Omit<
  FeatureDeliveryRequiredIntent,
  'ownerId' | 'ownerRole' | 'materialDigest'
>;

const identitySchema = z
  .object({
    subjectId: z.string().min(1).max(200),
    role: z.enum(['human_approver', 'plan_critic']),
    materialDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  })
  .strict();

export interface FeatureDeliveryIdentityClient {
  authenticate(input: {
    action: 'declare_intent' | 'approve_contract' | 'critic_review';
    runId: string;
    taskId: string;
    materialDigest: string;
  }): Promise<unknown>;
}

type RegisteredBoundary = {
  store: WorkflowStore;
  authenticate: FeatureDeliveryIdentityClient['authenticate'];
};

const registeredBoundaries = new WeakMap<OfficialFeatureDeliveryApprovalPort, RegisteredBoundary>();
const registeredApprovalBrokers = new WeakMap<
  FeatureDeliveryApprovalBroker,
  { store: WorkflowStore; port: OfficialFeatureDeliveryApprovalPort }
>();

export class OfficialFeatureDeliveryApprovalPort {
  readonly #store: WorkflowStore;
  readonly #authenticate: FeatureDeliveryIdentityClient['authenticate'];

  private constructor(store: WorkflowStore, client: FeatureDeliveryIdentityClient) {
    if (new.target !== OfficialFeatureDeliveryApprovalPort) {
      throw new Error('feature delivery approval port subclasses are forbidden');
    }
    this.#store = store;
    this.#authenticate = client.authenticate.bind(client);
    Object.defineProperties(this, {
      usesStore: { value: this.usesStore.bind(this), enumerable: false },
      declareRequiredIntent: { value: this.declareRequiredIntent.bind(this), enumerable: false },
      approve: { value: this.approve.bind(this), enumerable: false },
      recordCriticReview: { value: this.recordCriticReview.bind(this), enumerable: false },
    });
    registeredBoundaries.set(this, { store, authenticate: this.#authenticate });
    Object.freeze(this);
  }

  static create(
    store: WorkflowStore,
    client: FeatureDeliveryIdentityClient,
  ): OfficialFeatureDeliveryApprovalPort {
    return new OfficialFeatureDeliveryApprovalPort(store, client);
  }

  usesStore(store: WorkflowStore): boolean {
    const registered = registeredBoundaries.get(this);
    return (
      Object.getPrototypeOf(this) === OfficialFeatureDeliveryApprovalPort.prototype &&
      registered?.store === store &&
      registered.authenticate === this.#authenticate
    );
  }

  async declareRequiredIntent(
    input: FeatureDeliveryIntentDecision,
  ): Promise<FeatureDeliveryRequiredIntent> {
    const snapshot = JSON.parse(JSON.stringify(input)) as FeatureDeliveryIntentDecision;
    const materialDigest = deriveFeatureDeliveryIntentMaterialDigest(snapshot);
    const identity = identitySchema.parse(
      await this.#authenticate({
        action: 'declare_intent',
        runId: snapshot.runId,
        taskId: snapshot.taskId,
        materialDigest,
      }),
    );
    if (identity.role !== 'human_approver' || identity.materialDigest !== materialDigest) {
      throw new Error('feature delivery intent requires an authenticated human owner');
    }
    return this.#store.recordFeatureDeliveryRequiredIntent(
      featureDeliveryRequiredIntentSchema.parse({
        ...snapshot,
        materialDigest,
        ownerId: identity.subjectId,
        ownerRole: identity.role,
      }),
      workflowFeatureDeliveryIntentCapability,
    );
  }

  async approve(
    input: Omit<FeatureDeliveryApproval, 'approverId' | 'approverRole'>,
    contractInput: FeatureDeliveryContract,
  ): Promise<FeatureDeliveryApproval> {
    const contract = featureDeliveryContractSchema.parse(contractInput);
    const identity = identitySchema.parse(
      await this.#authenticate({
        action: 'approve_contract',
        runId: input.runId,
        taskId: input.taskId,
        materialDigest: input.materialDigest,
      }),
    );
    if (identity.role !== 'human_approver' || identity.materialDigest !== input.materialDigest) {
      throw new Error('feature delivery approval requires an authenticated human owner');
    }
    return this.#store.createFeatureDeliveryApproval(
      {
        ...input,
        approverId: identity.subjectId,
        approverRole: identity.role,
      },
      contract,
      workflowFeatureDeliveryApprovalCapability,
    );
  }

  async recordCriticReview(
    input: Omit<FeatureDeliveryCriticReview, 'criticId' | 'criticRole'>,
    contractInput: FeatureDeliveryContract,
  ): Promise<FeatureDeliveryCriticReview> {
    const identity = identitySchema.parse(
      await this.#authenticate({
        action: 'critic_review',
        runId: input.runId,
        taskId: input.taskId,
        materialDigest: input.materialDigest,
      }),
    );
    if (identity.role !== 'plan_critic' || identity.materialDigest !== input.materialDigest) {
      throw new Error('feature delivery review requires an authenticated plan critic');
    }
    return this.#store.recordFeatureDeliveryCriticReview(
      featureDeliveryCriticReviewSchema.parse({
        ...input,
        criticId: identity.subjectId,
        criticRole: identity.role,
      }),
      contractInput,
      workflowFeatureDeliveryCriticCapability,
    );
  }
}

export class FeatureDeliveryApprovalBroker {
  readonly #port: OfficialFeatureDeliveryApprovalPort;

  constructor(store: WorkflowStore, port: OfficialFeatureDeliveryApprovalPort) {
    if (new.target !== FeatureDeliveryApprovalBroker) {
      throw new Error('feature delivery approval broker subclasses are forbidden');
    }
    if (
      Object.getPrototypeOf(port) !== OfficialFeatureDeliveryApprovalPort.prototype ||
      !port.usesStore(store)
    ) {
      throw new Error('feature delivery approval port is not registered for this workflow store');
    }
    this.#port = port;
    Object.defineProperties(this, {
      declareRequiredIntent: { value: this.declareRequiredIntent.bind(this), enumerable: false },
      approve: { value: this.approve.bind(this), enumerable: false },
      recordCriticReview: { value: this.recordCriticReview.bind(this), enumerable: false },
    });
    registeredApprovalBrokers.set(this, { store, port });
    Object.freeze(this);
  }

  declareRequiredIntent(
    input: FeatureDeliveryIntentDecision,
  ): Promise<FeatureDeliveryRequiredIntent> {
    return this.#port.declareRequiredIntent(input);
  }

  recordCriticReview(
    input: Omit<FeatureDeliveryCriticReview, 'criticId' | 'criticRole'>,
    contract: FeatureDeliveryContract,
  ): Promise<FeatureDeliveryCriticReview> {
    return this.#port.recordCriticReview(input, contract);
  }

  approve(
    input: Omit<FeatureDeliveryApproval, 'approverId' | 'approverRole'>,
    contract: FeatureDeliveryContract,
  ): Promise<FeatureDeliveryApproval> {
    return this.#port.approve(input, contract);
  }
}

Object.freeze(OfficialFeatureDeliveryApprovalPort.prototype);
Object.freeze(FeatureDeliveryApprovalBroker.prototype);
