'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { VarSpec } from '@/lib/vars';

export type ParamEntry = { name: string; spec: VarSpec };

export function normalizeVarName(raw: string) {
  const s = (raw || '').toLowerCase().trim().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  return s || 'param';
}

type Props = {
  value: ParamEntry[];
  onChange: (entries: ParamEntry[]) => void;
  onInsertToken?: (name: string) => void;
};

export default function ParamBuilder({ value, onChange, onInsertToken }: Props) {
  const usedNames = useMemo(() => new Set(value.map((v) => v.name)), [value]);

  const addParam = () => {
    const base = 'param';
    let name = base;
    let i = 1;
    while (usedNames.has(name)) name = `${base}_${i++}`;
    onChange([
      ...value,
      { name, spec: { label: 'Parameter', type: 'text', placeholder: '', default: '', required: false } },
    ]);
  };

  const removeParam = (idx: number) => {
    const copy = [...value];
    copy.splice(idx, 1);
    onChange(copy);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= value.length) return;
    const copy = [...value];
    const [item] = copy.splice(idx, 1);
    copy.splice(j, 0, item);
    onChange(copy);
  };

  const update = (idx: number, next: ParamEntry) => {
    const copy = [...value];
    copy[idx] = next;
    onChange(copy);
  };

  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Parameters</h3>
        <Button type="button" size="sm" onClick={addParam}>
          Add parameter
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No parameters yet. Add one, then reference it in your prompt as <code>{'{name}'}</code>.
        </p>
      )}

      <div className="space-y-4">
        {value.map((entry, idx) => (
          <ParamCard
            key={idx}
            entry={entry}
            idx={idx}
            total={value.length}
            usedNames={usedNames}
            onInsertToken={onInsertToken}
            onUpdate={update}
            onMove={move}
            onRemove={removeParam}
          />
        ))}
      </div>
    </div>
  );
}

function ParamCard({
  entry,
  idx,
  total,
  usedNames,
  onInsertToken,
  onUpdate,
  onMove,
  onRemove,
}: {
  entry: ParamEntry;
  idx: number;
  total: number;
  usedNames: Set<string>;
  onInsertToken?: (name: string) => void;
  onUpdate: (idx: number, next: ParamEntry) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
}) {
  const [active, setActive] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Local buffer so commas are free-typed; commit to spec on blur/Enter
  const [optionsText, setOptionsText] = useState((entry.spec.options ?? []).join(', '));

  // Live preview default states (text/textarea/select)
  const [previewText, setPreviewText] = useState(String(entry.spec.default ?? ''));
  const [previewSelect, setPreviewSelect] = useState(String(entry.spec.default ?? ''));

  // Keep buffers in sync if the underlying spec changes (e.g., fork-prefill, switching types, or default edits)
  useEffect(() => {
    setOptionsText((entry.spec.options ?? []).join(', '));
  }, [entry.spec.type, entry.spec.options]);

  useEffect(() => {
    const d = String(entry.spec.default ?? '');
    setPreviewText(d);
    setPreviewSelect(d);
  }, [entry.spec.default]);

  // Parse live buffer for PREVIEW (instantly updates while typing)
  const optionsPreview = useMemo(
    () =>
      optionsText
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    [optionsText]
  );

  // Ensure previewSelect remains valid if options change
  useEffect(() => {
    if (entry.spec.type !== 'select') return;
    if (previewSelect && !optionsPreview.includes(previewSelect)) {
      setPreviewSelect(''); // fallback to placeholder if current value not in list
    }
  }, [entry.spec.type, optionsPreview, previewSelect]);

  const ensureUnique = (name: string, current: string) => {
    if (name === current) return name;
    if (!usedNames.has(name)) return name;
    let i = 1;
    let candidate = `${name}_${i}`;
    while (usedNames.has(candidate)) candidate = `${name}_${++i}`;
    return candidate;
  };

  const commitOptions = () => {
    const arr = optionsText
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    onUpdate(idx, { ...entry, spec: { ...entry.spec, options: arr } });
  };

  const handleFocusIn = () => setActive(true);
  const handleFocusOut = () => {
    // hide preview only when focus leaves this card
    setTimeout(() => {
      const el = cardRef.current;
      if (!el) return;
      if (!el.contains(document.activeElement)) setActive(false);
    }, 0);
  };

  return (
    <div
      ref={cardRef}
      className="rounded-md border bg-background p-3"
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`name-${idx}`}>Variable name</Label>
          <Input
            id={`name-${idx}`}
            value={entry.name}
            onChange={(e) => {
              const normalized = ensureUnique(normalizeVarName(e.target.value), entry.name);
              onUpdate(idx, { ...entry, name: normalized });
            }}
            placeholder="e.g., topic"
          />
          <p className="text-[11px] text-muted-foreground">
            Will be used as token <code>{`{${entry.name}}`}</code>
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`label-${idx}`}>Label</Label>
          <Input
            id={`label-${idx}`}
            value={entry.spec.label ?? ''}
            onChange={(e) => onUpdate(idx, { ...entry, spec: { ...entry.spec, label: e.target.value } })}
            placeholder="Topic"
          />
        </div>

        <div className="space-y-1">
          <Label>Type</Label>
          <Select
            value={entry.spec.type ?? 'text'}
            onValueChange={(val) => onUpdate(idx, { ...entry, spec: { ...entry.spec, type: val as VarSpec['type'] } })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="textarea">Textarea</SelectItem>
              <SelectItem value="select">Select</SelectItem>
              <SelectItem value="number">Number</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`placeholder-${idx}`}>Placeholder</Label>
          <Input
            id={`placeholder-${idx}`}
            value={entry.spec.placeholder ?? ''}
            onChange={(e) => onUpdate(idx, { ...entry, spec: { ...entry.spec, placeholder: e.target.value } })}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`default-${idx}`}>Default</Label>
          <Input
            id={`default-${idx}`}
            value={entry.spec.default ?? ''}
            onChange={(e) => onUpdate(idx, { ...entry, spec: { ...entry.spec, default: e.target.value } })}
          />
        </div>

        <div className="flex items-end gap-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`required-${idx}`}
              checked={!!entry.spec.required}
              onCheckedChange={(checked) =>
                onUpdate(idx, { ...entry, spec: { ...entry.spec, required: Boolean(checked) } })
              }
            />
            <Label htmlFor={`required-${idx}`}>Required</Label>
          </div>
        </div>
      </div>

      {entry.spec.type === 'select' && (
        <div className="mt-3 space-y-1">
          <Label htmlFor={`options-${idx}`}>Options (comma separated)</Label>
          <Textarea
            id={`options-${idx}`}
            rows={2}
            placeholder="e.g., casual, formal"
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            onBlur={commitOptions}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.shiftKey)) return; // allow multiline
              if (e.key === 'Enter') {
                e.preventDefault();
                commitOptions();
              }
            }}
          />
          <p className="text-[11px] text-muted-foreground">Default should be one of these if set.</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {onInsertToken && (
          <Button type="button" variant="secondary" size="sm" onClick={() => onInsertToken(entry.name)}>
            Insert {'{'}
            {entry.name}
            {'}'}
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onMove(idx, -1)} disabled={idx === 0}>
            ↑
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMove(idx, +1)}
            disabled={idx === total - 1}
          >
            ↓
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => onRemove(idx)}>
            Delete
          </Button>
        </div>
      </div>

      {/* Focus-driven inline preview (uses native controls and live defaults/options) */}
      {active && (
        <div className="mt-3 rounded-md border bg-muted/40 p-3">
          <p className="mb-2 text-xs text-muted-foreground">Preview</p>
          {renderPreview({
            entry,
            optionsPreview,
            previewText,
            setPreviewText,
            previewSelect,
            setPreviewSelect,
          })}
        </div>
      )}
    </div>
  );
}

function renderPreview({
  entry,
  optionsPreview,
  previewText,
  setPreviewText,
  previewSelect,
  setPreviewSelect,
}: {
  entry: ParamEntry;
  optionsPreview: string[];
  previewText: string;
  setPreviewText: (v: string) => void;
  previewSelect: string;
  setPreviewSelect: (v: string) => void;
}) {
  const req = entry.spec.required ? ' *' : '';

  if (entry.spec.type === 'textarea') {
    return (
      <div className="space-y-1">
        <Label>
          {entry.spec.label}
          {req}
        </Label>
        <Textarea
          placeholder={entry.spec.placeholder}
          rows={3}
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
        />
      </div>
    );
  }

  if (entry.spec.type === 'select') {
    // Interactive native select; value updates as you type options or default
    const hasDefault = !!previewSelect && optionsPreview.includes(previewSelect);
    const value = hasDefault ? previewSelect : '';

    return (
      <div className="space-y-1">
        <Label>
          {entry.spec.label}
          {req}
        </Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          value={value}
          onChange={(e) => setPreviewSelect(e.target.value)}
        >
          <option value="">{entry.spec.placeholder || 'Select...'}</option>
          {optionsPreview.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // text / number
  return (
    <div className="space-y-1">
      <Label>
        {entry.spec.label}
        {req}
      </Label>
      <Input
        type={entry.spec.type === 'number' ? 'number' : 'text'}
        placeholder={entry.spec.placeholder}
        value={previewText}
        onChange={(e) => setPreviewText(e.target.value)}
      />
    </div>
  );
}
