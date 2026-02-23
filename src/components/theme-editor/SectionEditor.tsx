/**
 * SectionEditor — edits a single section instance's settings.
 *
 * Displays a back button, section name (+ Arabic name), then renders
 * a SchemaForm driven by the section's schema definition.
 */

import { useCallback } from "react";
import type {
  SectionInstanceData,
  SectionSchemaData,
} from "@/services/themeApi";
import { SchemaForm } from "./SchemaForm";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export interface SectionEditorProps {
  section: SectionInstanceData;
  schema: SectionSchemaData;
  onChange: (sectionId: string, key: string, value: any) => void;
  onBack?: () => void;
}

export function SectionEditor({ section, schema, onChange, onBack }: SectionEditorProps) {
  const handleChange = useCallback(
    (key: string, value: any) => {
      onChange(section.id, key, value);
    },
    [section.id, onChange],
  );

  return (
    <div className="space-y-4">
      {/* Section header with back button */}
      <div className="flex items-center gap-2">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onBack}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">
            {schema.nameAr || schema.name}
          </h2>
          {schema.nameAr && schema.name && (
            <p className="text-xs text-muted-foreground">{schema.name}</p>
          )}
        </div>
      </div>

      {/* Dynamic settings form */}
      {schema.settings.length > 0 ? (
        <SchemaForm
          settings={schema.settings}
          values={section.settings}
          onChange={handleChange}
        />
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          This section has no configurable settings.
        </p>
      )}
    </div>
  );
}
