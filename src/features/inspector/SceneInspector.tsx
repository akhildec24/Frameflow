import { ColorField } from '../../components/ui/ColorField';
import { NumberField } from '../../components/ui/NumberField';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useEditorStore } from '../../state/editorStore';
import type { Scene, TransitionType } from '../../lib/types';

const TRANSITION_OPTIONS = [
  { value: 'cut', label: 'Cut' },
  { value: 'crossfade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'zoom', label: 'Zoom' },
] as const satisfies ReadonlyArray<{ value: TransitionType; label: string }>;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Transition type + duration controls for a scene's exit into the next slide. */
export function TransitionSection({ scene }: { scene: Scene }) {
  const setSceneTransition = useEditorStore((s) => s.setSceneTransition);

  const transitionType: TransitionType = scene.transitionOut?.type ?? 'cut';
  const transitionMs = scene.transitionOut?.durationMs ?? 400;

  const handleType = (type: TransitionType) => {
    setSceneTransition(scene.id, type === 'cut' ? undefined : { type, durationMs: transitionMs });
  };

  return (
    <section className="flex flex-col gap-2.5 border-b border-line p-3">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-secondary">Transition</h3>
      <SegmentedControl options={[...TRANSITION_OPTIONS]} value={transitionType} onChange={handleType} />
      <NumberField
        label="Duration"
        value={transitionMs}
        min={100}
        max={3000}
        step={50}
        suffix="ms"
        disabled={transitionType === 'cut'}
        onChange={(durationMs) => setSceneTransition(scene.id, { type: transitionType, durationMs })}
      />
      <p className="text-2xs text-ink-muted">Plays between this slide and the next during export.</p>
    </section>
  );
}

/**
 * Slide-level properties shown when no canvas element is selected:
 * duration, background and the transition into the next slide.
 */
export function SceneInspector({ scene }: { scene: Scene }) {
  const setSceneDuration = useEditorStore((s) => s.setSceneDuration);
  const setSceneBackground = useEditorStore((s) => s.setSceneBackground);

  const background = HEX_COLOR.test(scene.background ?? '') ? scene.background : '#ffffff';

  return (
    <>
      <div className="flex h-10 items-center border-b border-line px-3">
        <p className="truncate text-sm font-medium text-ink">{scene.name}</p>
      </div>

      <section className="flex flex-col gap-2.5 border-b border-line p-3">
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-secondary">Slide</h3>
        <div className="grid grid-cols-2 items-end gap-2">
          <NumberField
            label="Duration"
            value={scene.durationMs / 1000}
            min={0.5}
            step={0.5}
            suffix="s"
            onChange={(seconds) => setSceneDuration(scene.id, seconds * 1000)}
          />
          <label className="flex flex-col gap-1">
            <span className="text-2xs text-ink-secondary">Background</span>
            <ColorField
              value={background}
              aria-label="Slide background"
              onChange={(hex) => setSceneBackground(scene.id, hex)}
            />
          </label>
        </div>
      </section>

      <TransitionSection scene={scene} />
    </>
  );
}
