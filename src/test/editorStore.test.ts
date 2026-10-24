import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../state/editorStore';
import { createNewProject } from '../features/projects/createProject';
import type { MediaAsset, MediaElement } from '../lib/types';

function freshProject() {
  return createNewProject({ name: 'Test project', mode: 'slideshow', width: 1920, height: 1080, fps: 30 });
}

const sampleAsset: MediaAsset = {
  id: 'asset-1',
  name: 'photo.jpg',
  type: 'image',
  mimeType: 'image/jpeg',
  width: 1000,
  height: 1000,
  sizeBytes: 1000,
  storageKey: 'asset-1',
  createdAt: new Date().toISOString(),
  status: 'ready',
};

beforeEach(() => {
  useEditorStore.getState().closeProject();
  useEditorStore.getState().loadProject(freshProject());
});

describe('editorStore text and media elements', () => {
  it('adds a text element to the active scene and selects it', () => {
    useEditorStore.getState().addTextElement();
    const state = useEditorStore.getState();
    const scene = state.project!.scenes[0];
    expect(scene.elements).toHaveLength(1);
    expect(scene.elements[0].kind).toBe('text');
    expect(state.selectedElementIds).toEqual([scene.elements[0].id]);
  });

  it('adds a media element at a given centre point, clamped to the canvas', () => {
    useEditorStore.getState().addMediaElement(sampleAsset, { x: -500, y: -500 });
    const element = useEditorStore.getState().project!.scenes[0].elements[0];
    expect(element.transform.x).toBe(0);
    expect(element.transform.y).toBe(0);
  });
});

describe('editorStore undo/redo', () => {
  it('undoes and redoes a discrete edit', () => {
    useEditorStore.getState().addTextElement();
    expect(useEditorStore.getState().project!.scenes[0].elements).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project!.scenes[0].elements).toHaveLength(0);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project!.scenes[0].elements).toHaveLength(1);
  });

  it('coalesces a drag transaction into a single history entry', () => {
    useEditorStore.getState().addTextElement();
    const elementId = useEditorStore.getState().project!.scenes[0].elements[0].id;
    const originalX = useEditorStore.getState().project!.scenes[0].elements[0].transform.x;
    const pastLengthBefore = useEditorStore.getState().past.length;

    const snapshot = useEditorStore.getState().beginTransaction();
    useEditorStore.getState().updateElementLive(elementId, (el) => {
      el.transform.x += 10;
    });
    useEditorStore.getState().updateElementLive(elementId, (el) => {
      el.transform.x += 10;
    });
    useEditorStore.getState().commitTransaction(snapshot);

    // Many live updates during one drag collapse into a single history entry.
    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);
    expect(useEditorStore.getState().project!.scenes[0].elements[0].transform.x).toBe(originalX + 20);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project!.scenes[0].elements[0].transform.x).toBe(originalX);
  });

  it('removes and duplicates elements', () => {
    useEditorStore.getState().addTextElement();
    const elementId = useEditorStore.getState().project!.scenes[0].elements[0].id;

    useEditorStore.getState().duplicateElements([elementId]);
    expect(useEditorStore.getState().project!.scenes[0].elements).toHaveLength(2);

    useEditorStore.getState().removeElements(useEditorStore.getState().selectedElementIds);
    expect(useEditorStore.getState().project!.scenes[0].elements).toHaveLength(1);
  });
});

describe('editorStore scenes', () => {
  it('adds, duplicates and removes scenes, keeping at least one', () => {
    useEditorStore.getState().addScene();
    expect(useEditorStore.getState().project!.scenes).toHaveLength(2);

    const firstSceneId = useEditorStore.getState().project!.scenes[0].id;
    useEditorStore.getState().removeScene(firstSceneId);
    expect(useEditorStore.getState().project!.scenes).toHaveLength(1);

    const lastSceneId = useEditorStore.getState().project!.scenes[0].id;
    useEditorStore.getState().removeScene(lastSceneId);
    expect(useEditorStore.getState().project!.scenes).toHaveLength(1);
  });
});

describe('editorStore slideshow generation', () => {
  const secondAsset: MediaAsset = { ...sampleAsset, id: 'asset-2', name: 'photo-2.jpg', storageKey: 'asset-2' };

  it('creates one full-bleed slide per image, reusing an empty active scene', () => {
    useEditorStore.getState().addAssets([sampleAsset, secondAsset]);
    useEditorStore.getState().createSlideshowFromAssets([sampleAsset.id, secondAsset.id]);

    const project = useEditorStore.getState().project!;
    expect(project.scenes).toHaveLength(2);

    // First asset reuses the empty initial scene rather than leaving a blank slide.
    expect(project.scenes[0].elements).toHaveLength(1);
    expect(project.scenes[0].elements[0]).toMatchObject({ kind: 'media', assetId: 'asset-1' });
    expect(project.scenes[0].elements[0].transform).toMatchObject({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      fit: 'cover',
    });

    expect(project.scenes[1].elements[0]).toMatchObject({ kind: 'media', assetId: 'asset-2' });
    expect(project.activeSceneId).toBe(project.scenes[0].id);
  });

  it('appends new scenes when the active scene already has elements', () => {
    useEditorStore.getState().addTextElement();
    useEditorStore.getState().addAssets([sampleAsset]);
    useEditorStore.getState().createSlideshowFromAssets([sampleAsset.id]);

    const project = useEditorStore.getState().project!;
    expect(project.scenes).toHaveLength(2);
    expect(project.scenes[0].elements[0].kind).toBe('text');
    expect(project.scenes[1].elements[0]).toMatchObject({ kind: 'media', assetId: 'asset-1' });
  });

  it('is a single undoable edit and skips unknown asset ids', () => {
    useEditorStore.getState().addAssets([sampleAsset]);
    useEditorStore.getState().createSlideshowFromAssets(['missing-id', sampleAsset.id]);

    const project = useEditorStore.getState().project!;
    expect(project.scenes).toHaveLength(1);
    expect(project.scenes[0].elements).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project!.scenes[0].elements).toHaveLength(0);
  });
});

describe('captions', () => {
  const secondAsset: MediaAsset = { ...sampleAsset, id: 'asset-2', name: 'photo-2.jpg', storageKey: 'asset-2' };

  it('applies caption rules to media elements across all slides, preserving per-slide text', () => {
    useEditorStore.getState().addAssets([sampleAsset, secondAsset]);
    useEditorStore.getState().createSlideshowFromAssets([sampleAsset.id, secondAsset.id]);

    const firstElementId = useEditorStore.getState().project!.scenes[0].elements[0].id;
    useEditorStore.getState().updateElement(firstElementId, (el) => {
      if (el.kind === 'media') el.caption = { show: true, position: 'bottom', style: 'bar', text: 'My words' };
    });

    useEditorStore.getState().applyCaptionToAllSlides({ show: true, position: 'top', style: 'pill' });

    const scenes = useEditorStore.getState().project!.scenes;
    const first = scenes[0].elements[0] as MediaElement;
    const second = scenes[1].elements[0] as MediaElement;
    expect(first.caption).toEqual({ show: true, position: 'top', style: 'pill', text: 'My words' });
    expect(second.caption).toEqual({ show: true, position: 'top', style: 'pill' });

    useEditorStore.getState().undo();
    const undone = useEditorStore.getState().project!.scenes[1].elements[0] as MediaElement;
    expect(undone.caption).toBeUndefined();
  });
});

describe('scene properties', () => {
  it('stores and clears a slide transition', () => {
    const sceneId = useEditorStore.getState().project!.scenes[0].id;
    useEditorStore.getState().setSceneTransition(sceneId, { type: 'crossfade', durationMs: 400 });
    expect(useEditorStore.getState().project!.scenes[0].transitionOut).toEqual({ type: 'crossfade', durationMs: 400 });

    useEditorStore.getState().setSceneTransition(sceneId, undefined);
    expect(useEditorStore.getState().project!.scenes[0].transitionOut).toBeUndefined();
  });

  it('updates slide background and duration', () => {
    const sceneId = useEditorStore.getState().project!.scenes[0].id;
    useEditorStore.getState().setSceneBackground(sceneId, '#123456');
    useEditorStore.getState().setSceneDuration(sceneId, 6000);

    const scene = useEditorStore.getState().project!.scenes[0];
    expect(scene.background).toBe('#123456');
    expect(scene.durationMs).toBe(6000);
  });

  it('reorders scenes with moveScene', () => {
    useEditorStore.getState().addScene();
    useEditorStore.getState().addScene();
    const ids = useEditorStore.getState().project!.scenes.map((s) => s.id);

    useEditorStore.getState().moveScene(ids[0], 2);
    expect(useEditorStore.getState().project!.scenes.map((s) => s.id)).toEqual([ids[1], ids[2], ids[0]]);

    useEditorStore.getState().moveScene(ids[0], 0);
    expect(useEditorStore.getState().project!.scenes.map((s) => s.id)).toEqual(ids);
  });

  it('renumbers auto-named slides on reorder but keeps custom names', () => {
    useEditorStore.getState().addScene();
    useEditorStore.getState().addScene();
    const ids = useEditorStore.getState().project!.scenes.map((s) => s.id);
    useEditorStore.getState().renameScene(ids[1], 'Intro');

    useEditorStore.getState().moveScene(ids[0], 2);
    expect(useEditorStore.getState().project!.scenes.map((s) => s.name)).toEqual(['Intro', 'Scene 2', 'Scene 3']);
  });
});
