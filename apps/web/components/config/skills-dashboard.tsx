'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Skill, SkillCreateBody } from '@agent-platform/contracts';
import { apiGet, apiDelete, apiPost, apiPut, apiPath, ApiRequestError } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, Zap, MoreVertical, Pencil, Trash2, Copy, ArrowLeft, Save, Loader2 } from 'lucide-react';

/* ─── Dashboard ─── */

export function SkillsDashboard() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState<Skill | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Skill[]>(apiPath('skills'));
      setSkills(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this skill?')) return;
    try {
      await apiDelete(apiPath('skills', id));
      await load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, [load]);

  const handleDuplicate = useCallback(async (skill: Skill) => {
    try {
      const body: SkillCreateBody = {
        name: `${skill.name} (Copy)`,
        goal: skill.goal,
        constraints: skill.constraints,
        tools: skill.tools,
        outputSchema: skill.outputSchema,
      };
      await apiPost(apiPath('skills'), body);
      await load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, [load]);

  const filtered = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.goal.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (editing !== null) {
    return (
      <SkillEditor
        skill={editing === 'new' ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Skills</h1>
          <p className="text-sm text-muted-foreground">Define reusable skill definitions for agents</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Skill
        </Button>
      </header>

      <div className="px-6 py-4 border-b border-border">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <div className="px-6 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">No skills found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Create your first skill definition'}
            </p>
            {!searchQuery && (
              <Button variant="outline" onClick={() => setEditing('new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Skill
              </Button>
            )}
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((skill) => (
              <div
                key={skill.id}
                className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(skill)}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { handleDuplicate(skill); }}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { handleDelete(skill.id); }} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <button type="button" onClick={() => setEditing(skill)} className="block text-left w-full">
                  <h3 className="font-semibold text-foreground mb-1">{skill.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{skill.goal}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skill.tools.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {skill.tools.length} tool{skill.tools.length === 1 ? '' : 's'}
                      </Badge>
                    )}
                    {skill.constraints.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {skill.constraints.length} constraint{skill.constraints.length === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Editor ─── */

interface SkillEditorProps {
  skill?: Skill;
  onCancel: () => void;
  onSaved: () => void;
}

function SkillEditor({ skill, onCancel, onSaved }: Readonly<SkillEditorProps>) {
  const [name, setName] = useState(skill?.name ?? '');
  const [goal, setGoal] = useState(skill?.goal ?? '');
  const [constraintsText, setConstraintsText] = useState(skill?.constraints.join('\n') ?? '');
  const [toolsText, setToolsText] = useState(skill?.tools.join('\n') ?? '');
  const [outputSchemaText, setOutputSchemaText] = useState(
    skill?.outputSchema ? JSON.stringify(skill.outputSchema, null, 2) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }
    if (!goal.trim()) { setError('Goal is required'); return; }

    let outputSchema: Record<string, unknown> | undefined;
    if (outputSchemaText.trim()) {
      try {
        outputSchema = JSON.parse(outputSchemaText) as Record<string, unknown>;
      } catch {
        setError('Output schema must be valid JSON');
        return;
      }
    }

    setSaving(true);
    try {
      const body: SkillCreateBody = {
        name: name.trim(),
        goal: goal.trim(),
        constraints: constraintsText.split('\n').map((l) => l.trim()).filter(Boolean),
        tools: toolsText.split('\n').map((l) => l.trim()).filter(Boolean),
        outputSchema,
      };

      if (skill) {
        await apiPut(apiPath('skills', skill.id), body);
      } else {
        await apiPost(apiPath('skills'), body);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [name, goal, constraintsText, toolsText, outputSchemaText, skill, onSaved]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {skill ? 'Edit Skill' : 'New Skill'}
          </h1>
        </div>
        <Button onClick={() => { handleSave(); }} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {skill ? 'Update' : 'Create'}
        </Button>
      </header>

      {error && (
        <div className="px-6 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <div className="space-y-2">
            <Label htmlFor="skill-name">Name</Label>
            <Input id="skill-name" placeholder="My Skill" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-goal">Goal</Label>
            <Textarea id="skill-goal" rows={3} placeholder="What this skill accomplishes..." value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-constraints">Constraints (one per line)</Label>
            <Textarea id="skill-constraints" rows={4} placeholder="Must not exceed 1000 tokens&#10;Must use JSON output" value={constraintsText} onChange={(e) => setConstraintsText(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-tools">Tools (one per line)</Label>
            <Textarea id="skill-tools" rows={3} placeholder="web_search&#10;code_interpreter" value={toolsText} onChange={(e) => setToolsText(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-schema">Output Schema (JSON, optional)</Label>
            <Textarea
              id="skill-schema"
              rows={5}
              placeholder='{"type": "object", ...}'
              value={outputSchemaText}
              onChange={(e) => setOutputSchemaText(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
