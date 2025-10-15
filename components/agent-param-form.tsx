'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { extractVarsAndBody, applyVars, VarsDict, VarSpec } from '@/lib/vars';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type AgentParamFormHandle = {
  getOverridePrompt: () => string | null;
  hasParams: () => boolean;
  getValues: () => Record<string, string>;
  getDefaults: () => Record<string, string>;
};

export default forwardRef<AgentParamFormHandle, {
  prompt: string;
  urlPrefill?: Record<string, string>;
  onValuesChange?: (values: Record<string, string>) => void;
}>(function AgentParamForm(
  { prompt, urlPrefill, onValuesChange },
  ref
) {
  const { vars, body } = useMemo(() => extractVarsAndBody(prompt || ''), [prompt]);

  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});

  // Build defaults from VARS (no URL here)
  useEffect(() => {
    if (!vars) { setDefaults({}); return; }
    const d: Record<string, string> = {};
    Object.entries(vars).forEach(([k, spec]) => { d[k] = spec.default !== undefined ? String(spec.default) : ''; });
    setDefaults(d);
  }, [vars]);

  // Initialize values = defaults, then apply URL prefill (URL wins)
  useEffect(() => {
    if (!vars) { setValues({}); return; }
    const v: Record<string, string> = { ...defaults };
    if (urlPrefill) {
      for (const [k, val] of Object.entries(urlPrefill)) {
        if (k in v) v[k] = String(val);
      }
    }
    setValues(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vars, defaults, urlPrefill]);

  useEffect(() => { onValuesChange?.(values); }, [values, onValuesChange]);

  useImperativeHandle(ref, () => ({
    getOverridePrompt: () => {
      if (!vars || Object.keys(vars).length === 0) return null;
      for (const [k, spec] of Object.entries(vars)) {
        if (spec.required && !values[k]) return null;
      }
      return applyVars(body, values);
    },
    hasParams: () => !!vars && Object.keys(vars).length > 0,
    getValues: () => values,
    getDefaults: () => defaults,
  }));

  if (!vars || Object.keys(vars).length === 0) return null;

  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <h3 className="mb-3 text-sm font-semibold">Parameters</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(vars).map(([key, spec]) => (
          <ParamInput
            key={key}
            name={key}
            spec={spec}
            value={values[key] ?? ''}
            onChange={(val) => setValues((p) => ({ ...p, [key]: val }))}
          />
        ))}
      </div>
    </div>
  );
});

function ParamInput({
  name,
  spec,
  value,
  onChange,
}: {
  name: string;
  spec: VarSpec;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `param-${name}`;
  const label = spec.label ?? name;

  if (spec.type === 'textarea') {
    return (
      <div className="col-span-2 space-y-1">
        <Label htmlFor={id}>{label}{spec.required ? ' *' : ''}</Label>
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={spec.placeholder}
          rows={4}
          className="font-mono text-sm"
        />
      </div>
    );
  }

  if (spec.type === 'select' && spec.options?.length) {
    const baseOpts = spec.options;
    const allOptions = value && !baseOpts.includes(value) ? [value, ...baseOpts] : baseOpts;
    return (
      <div className="space-y-1">
        <Label>{label}{spec.required ? ' *' : ''}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={spec.placeholder ?? 'Select...'} /></SelectTrigger>
          <SelectContent>
            {allOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}{spec.required ? ' *' : ''}</Label>
      <Input
        id={id}
        type={spec.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={spec.placeholder}
      />
    </div>
  );
}
