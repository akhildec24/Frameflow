import { useEffect, useRef } from 'react';
import { useEditorStore } from '../../state/editorStore';
import type { Scene } from '../../lib/types';

interface TextEditOverlayProps {
  elementId: string;
  scene: Scene;
  scale: number;
  offset: { x: number; y: number };
  onClose: () => void;
}

export function TextEditOverlay({ elementId, scene, scale, offset, onClose }: TextEditOverlayProps) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const element = scene.elements.find((el) => el.id === elementId);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  if (!element || element.kind !== 'text') return null;

  const { transform } = element;

  const commit = () => {
    const value = textareaRef.current?.value ?? element.content;
    updateElement(elementId, (el) => {
      if (el.kind === 'text') el.content = value;
    });
    onClose();
  };

  return (
    <textarea
      ref={textareaRef}
      defaultValue={element.content}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
      }}
      style={{
        position: 'absolute',
        left: offset.x + transform.x * scale,
        top: offset.y + transform.y * scale,
        width: transform.width * scale,
        height: transform.height * scale,
        fontFamily: element.style.fontFamily,
        fontSize: element.style.fontSize * scale,
        fontWeight: element.style.fontWeight,
        color: element.style.colour,
        lineHeight: element.style.lineHeight,
        letterSpacing: `${element.style.letterSpacing * element.style.fontSize}px`,
        textAlign: element.style.align === 'centre' ? 'center' : element.style.align,
        resize: 'none',
        border: '1.5px solid #C66F42',
        outline: 'none',
        padding: 0,
        background: 'rgba(255,255,255,0.85)',
      }}
    />
  );
}
