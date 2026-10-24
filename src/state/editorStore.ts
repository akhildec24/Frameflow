import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import type { CaptionConfig, Element, MediaAsset, Project, ProjectMode, Scene, SceneTransition } from '../lib/types';
import { createEmptyScene, createMediaElement, createTextElement } from '../features/canvas/elementFactory';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface HistorySnapshot {
  scenes: Scene[];
  assets: Record<string, MediaAsset>;
}

const MAX_HISTORY = 60;

interface EditorState {
  project: Project | null;
  selectedElementIds: string[];
  saveStatus: SaveStatus;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  cropEditingElementId: string | null;

  loadProject: (project: Project) => void;
  closeProject: () => void;
  setSaveStatus: (status: SaveStatus) => void;
  setCropEditingElement: (id: string | null) => void;

  setActiveScene: (sceneId: string) => void;
  addScene: () => void;
  duplicateScene: (sceneId: string) => void;
  removeScene: (sceneId: string) => void;
  moveScene: (sceneId: string, toIndex: number) => void;
  renameScene: (sceneId: string, name: string) => void;
  setSceneDuration: (sceneId: string, durationMs: number) => void;
  setSceneBackground: (sceneId: string, background: string) => void;
  setSceneTransition: (sceneId: string, transition: SceneTransition | undefined) => void;

  selectElements: (ids: string[]) => void;
  toggleSelect: (id: string, additive?: boolean) => void;
  clearSelection: () => void;

  addMediaElement: (asset: MediaAsset, centre?: { x: number; y: number }) => void;
  createSlideshowFromAssets: (assetIds: string[]) => void;
  addTextElement: () => void;
  updateElement: (elementId: string, recipe: (el: Draft<Element>) => void) => void;
  updateElementLive: (elementId: string, recipe: (el: Draft<Element>) => void) => void;
  alignElements: (elementIds: string[], mode: AlignMode) => void;
  applyCaptionToAllSlides: (caption: Pick<CaptionConfig, 'show' | 'position' | 'style'>) => void;
  removeElements: (elementIds: string[]) => void;
  duplicateElements: (elementIds: string[]) => void;
  reorderZ: (elementId: string, direction: 'front' | 'forward' | 'backward' | 'back') => void;
  toggleLock: (elementId: string) => void;
  toggleHidden: (elementId: string) => void;

  addAssets: (assets: MediaAsset[]) => void;
  removeAsset: (assetId: string) => void;
  renameAsset: (assetId: string, name: string) => void;

  renameProject: (name: string) => void;
  setProjectFormat: (mode: ProjectMode, width: number, height: number) => void;

  beginTransaction: () => HistorySnapshot | null;
  commitTransaction: (snapshot: HistorySnapshot | null) => void;
  undo: () => void;
  redo: () => void;
}

function snapshotOf(project: Project): HistorySnapshot {
  return { scenes: project.scenes, assets: project.assets };
}

function activeScene(project: Project): Scene | undefined {
  return project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0];
}

const AUTO_SCENE_NAME = /^(Slide|Scene)\s\d+$/;

/** Keeps auto-generated "Slide N"/"Scene N" labels sequential after reorders; user-renamed scenes are untouched. */
function renumberAutoNamedScenes(draft: Draft<Project>): void {
  draft.scenes.forEach((scene, index) => {
    const match = AUTO_SCENE_NAME.exec(scene.name);
    if (match) scene.name = `${match[1]} ${index + 1}`;
  });
}

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  selectedElementIds: [],
  saveStatus: 'idle',
  past: [],
  future: [],
  cropEditingElementId: null,

  loadProject: (project) =>
    set({ project, selectedElementIds: [], past: [], future: [], saveStatus: 'saved', cropEditingElementId: null }),
  closeProject: () =>
    set({ project: null, selectedElementIds: [], past: [], future: [], saveStatus: 'idle', cropEditingElementId: null }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setCropEditingElement: (id) => set({ cropEditingElementId: id }),

  setActiveScene: (sceneId) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: { ...state.project, activeSceneId: sceneId },
        selectedElementIds: [],
      };
    }),

  addScene: () =>
    applyEdit(set, get, (draft) => {
      const scene = createEmptyScene(`Scene ${draft.scenes.length + 1}`);
      draft.scenes.push(scene as Draft<Scene>);
      draft.activeSceneId = scene.id;
      renumberAutoNamedScenes(draft);
    }),

  duplicateScene: (sceneId) =>
    applyEdit(set, get, (draft) => {
      const index = draft.scenes.findIndex((s) => s.id === sceneId);
      if (index === -1) return;
      const original = draft.scenes[index];
      const clone: Scene = JSON.parse(JSON.stringify(original));
      clone.id = crypto.randomUUID();
      clone.name = `${original.name} copy`;
      clone.elements = clone.elements.map((el) => ({ ...el, id: crypto.randomUUID() }));
      draft.scenes.splice(index + 1, 0, clone as Draft<Scene>);
      draft.activeSceneId = clone.id;
      renumberAutoNamedScenes(draft);
    }),

  removeScene: (sceneId) =>
    applyEdit(set, get, (draft) => {
      if (draft.scenes.length <= 1) return;
      const index = draft.scenes.findIndex((s) => s.id === sceneId);
      if (index === -1) return;
      draft.scenes.splice(index, 1);
      if (draft.activeSceneId === sceneId) {
        draft.activeSceneId = draft.scenes[Math.max(0, index - 1)].id;
      }
      renumberAutoNamedScenes(draft);
    }),

  moveScene: (sceneId, toIndex) =>
    applyEdit(set, get, (draft) => {
      const fromIndex = draft.scenes.findIndex((s) => s.id === sceneId);
      if (fromIndex === -1 || fromIndex === toIndex) return;
      const [scene] = draft.scenes.splice(fromIndex, 1);
      draft.scenes.splice(Math.max(0, Math.min(toIndex, draft.scenes.length)), 0, scene);
      renumberAutoNamedScenes(draft);
    }),

  renameScene: (sceneId, name) =>
    applyEdit(set, get, (draft) => {
      const scene = draft.scenes.find((s) => s.id === sceneId);
      if (scene) scene.name = name;
    }),

  setSceneDuration: (sceneId, durationMs) =>
    applyEdit(set, get, (draft) => {
      const scene = draft.scenes.find((s) => s.id === sceneId);
      if (scene) scene.durationMs = Math.max(500, durationMs);
    }),

  setSceneBackground: (sceneId, background) =>
    applyEdit(set, get, (draft) => {
      const scene = draft.scenes.find((s) => s.id === sceneId);
      if (scene) scene.background = background;
    }),

  setSceneTransition: (sceneId, transition) =>
    applyEdit(set, get, (draft) => {
      const scene = draft.scenes.find((s) => s.id === sceneId);
      if (!scene) return;
      if (transition) scene.transitionOut = transition;
      else delete scene.transitionOut;
    }),

  selectElements: (ids) => set({ selectedElementIds: ids, cropEditingElementId: null }),
  toggleSelect: (id, additive) =>
    set((state) => {
      if (!additive) return { selectedElementIds: [id], cropEditingElementId: null };
      const exists = state.selectedElementIds.includes(id);
      return {
        selectedElementIds: exists
          ? state.selectedElementIds.filter((existing) => existing !== id)
          : [...state.selectedElementIds, id],
        cropEditingElementId: null,
      };
    }),
  clearSelection: () => set({ selectedElementIds: [], cropEditingElementId: null }),

  addMediaElement: (asset, centre) =>
    applyEdit(set, get, (draft) => {
      const scene = draft.scenes.find((s) => s.id === draft.activeSceneId) ?? draft.scenes[0];
      if (!scene) return;
      const element = createMediaElement(asset, scene as Scene, { width: draft.width, height: draft.height });
      if (centre) {
        element.transform.x = Math.min(
          Math.max(0, centre.x - element.transform.width / 2),
          Math.max(0, draft.width - element.transform.width),
        );
        element.transform.y = Math.min(
          Math.max(0, centre.y - element.transform.height / 2),
          Math.max(0, draft.height - element.transform.height),
        );
      }
      scene.elements.push(element as Draft<Element>);
      get().selectElements([element.id]);
    }),

  createSlideshowFromAssets: (assetIds) =>
    applyEdit(set, get, (draft) => {
      const activeIndex = draft.scenes.findIndex((s) => s.id === draft.activeSceneId);
      const current = draft.scenes[activeIndex] ?? draft.scenes[0];
      const reuseCurrent = !!current && current.elements.length === 0;
      let firstSceneId: string | null = null;

      assetIds.forEach((assetId) => {
        const asset = draft.assets[assetId];
        if (!asset) return;

        let scene: Draft<Scene>;
        if (!firstSceneId && reuseCurrent && current) {
          scene = current;
        } else {
          scene = createEmptyScene(`Slide ${draft.scenes.length + 1}`) as Draft<Scene>;
          draft.scenes.push(scene);
        }

        const element = createMediaElement(asset as MediaAsset, scene as Scene, {
          width: draft.width,
          height: draft.height,
        }, { fullBleed: true });
        scene.elements.push(element as Draft<Element>);
        firstSceneId ??= scene.id;
      });

      if (firstSceneId) draft.activeSceneId = firstSceneId;
      renumberAutoNamedScenes(draft);
    }),

  addTextElement: () =>
    applyEdit(set, get, (draft) => {
      const scene = draft.scenes.find((s) => s.id === draft.activeSceneId) ?? draft.scenes[0];
      if (!scene) return;
      const element = createTextElement(scene as Scene, { width: draft.width, height: draft.height });
      scene.elements.push(element as Draft<Element>);
      get().selectElements([element.id]);
    }),

  updateElement: (elementId, recipe) =>
    applyEdit(set, get, (draft) => {
      const scene = activeScene(draft as unknown as Project);
      const element = scene?.elements.find((el) => el.id === elementId);
      if (element) recipe(element as Draft<Element>);
    }),

  alignElements: (elementIds, mode) =>
    applyEdit(set, get, (draft) => {
      const scene = draft.scenes.find((s) => s.id === draft.activeSceneId) ?? draft.scenes[0];
      if (!scene) return;
      const ids = new Set(elementIds);
      for (const el of scene.elements) {
        if (!ids.has(el.id)) continue;
        const { width, height } = el.transform;
        if (mode === 'left') el.transform.x = 0;
        else if (mode === 'centerX') el.transform.x = (draft.width - width) / 2;
        else if (mode === 'right') el.transform.x = draft.width - width;
        else if (mode === 'top') el.transform.y = 0;
        else if (mode === 'centerY') el.transform.y = (draft.height - height) / 2;
        else if (mode === 'bottom') el.transform.y = draft.height - height;
      }
    }),

  applyCaptionToAllSlides: (caption) =>
    applyEdit(set, get, (draft) => {
      for (const scene of draft.scenes) {
        for (const el of scene.elements) {
          if (el.kind !== 'media') continue;
          // Each element keeps its own text override / embedded caption.
          el.caption = { ...el.caption, show: caption.show, position: caption.position, style: caption.style };
        }
      }
    }),

  updateElementLive: (elementId, recipe) =>
    set((state) => {
      if (!state.project) return state;
      const nextProject = produce(state.project, (draft) => {
        const scene = activeScene(draft);
        const element = scene?.elements.find((el) => el.id === elementId);
        if (element) recipe(element as Draft<Element>);
      });
      return { project: nextProject };
    }),

  removeElements: (elementIds) =>
    applyEdit(set, get, (draft) => {
      const scene = activeScene(draft as unknown as Project);
      if (!scene) return;
      scene.elements = scene.elements.filter((el) => !elementIds.includes(el.id)) as Draft<Element[]>;
    }),

  duplicateElements: (elementIds) =>
    applyEdit(set, get, (draft) => {
      const scene = activeScene(draft as unknown as Project);
      if (!scene) return;
      const clones: Element[] = [];
      for (const el of scene.elements) {
        if (!elementIds.includes(el.id)) continue;
        const clone: Element = JSON.parse(JSON.stringify(el));
        clone.id = crypto.randomUUID();
        clone.name = `${el.name} copy`;
        clone.transform.x += 16;
        clone.transform.y += 16;
        clone.zIndex = scene.elements.reduce((m, e) => Math.max(m, e.zIndex), 0) + 1;
        clones.push(clone);
      }
      scene.elements.push(...(clones as Draft<Element>[]));
      get().selectElements(clones.map((c) => c.id));
    }),

  reorderZ: (elementId, direction) =>
    applyEdit(set, get, (draft) => {
      const scene = activeScene(draft as unknown as Project);
      if (!scene) return;
      const sorted = [...scene.elements].sort((a, b) => a.zIndex - b.zIndex);
      const index = sorted.findIndex((el) => el.id === elementId);
      if (index === -1) return;
      const [item] = sorted.splice(index, 1);
      if (direction === 'front') sorted.push(item);
      else if (direction === 'back') sorted.unshift(item);
      else if (direction === 'forward') sorted.splice(Math.min(sorted.length, index + 1), 0, item);
      else sorted.splice(Math.max(0, index - 1), 0, item);
      sorted.forEach((el, i) => {
        const target = scene.elements.find((e) => e.id === el.id);
        if (target) target.zIndex = i;
      });
    }),

  toggleLock: (elementId) =>
    applyEdit(set, get, (draft) => {
      const scene = activeScene(draft as unknown as Project);
      const element = scene?.elements.find((el) => el.id === elementId);
      if (element) element.locked = !element.locked;
    }),

  toggleHidden: (elementId) =>
    applyEdit(set, get, (draft) => {
      const scene = activeScene(draft as unknown as Project);
      const element = scene?.elements.find((el) => el.id === elementId);
      if (element) element.hidden = !element.hidden;
    }),

  addAssets: (assets) =>
    applyEdit(set, get, (draft) => {
      for (const asset of assets) {
        draft.assets[asset.id] = asset as Draft<MediaAsset>;
      }
    }),

  removeAsset: (assetId) =>
    applyEdit(set, get, (draft) => {
      delete draft.assets[assetId];
      for (const scene of draft.scenes) {
        scene.elements = scene.elements.filter(
          (el) => !(el.kind === 'media' && el.assetId === assetId),
        ) as Draft<Element[]>;
      }
    }),

  renameAsset: (assetId, name) =>
    applyEdit(set, get, (draft) => {
      const asset = draft.assets[assetId];
      if (asset) asset.name = name;
    }),

  renameProject: (name) =>
    applyEdit(set, get, (draft) => {
      draft.name = name;
    }),

  setProjectFormat: (mode, width, height) =>
    applyEdit(set, get, (draft) => {
      draft.mode = mode;
      draft.width = width;
      draft.height = height;
    }),

  beginTransaction: () => {
    const project = get().project;
    return project ? snapshotOf(project) : null;
  },

  commitTransaction: (snapshot) => {
    if (!snapshot) return;
    set((state) => ({
      past: [...state.past.slice(-(MAX_HISTORY - 1)), snapshot],
      future: [],
    }));
  },

  undo: () =>
    set((state) => {
      if (!state.project || state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const currentSnapshot = snapshotOf(state.project);
      return {
        project: { ...state.project, scenes: previous.scenes, assets: previous.assets },
        past: state.past.slice(0, -1),
        future: [...state.future, currentSnapshot],
        selectedElementIds: [],
      };
    }),

  redo: () =>
    set((state) => {
      if (!state.project || state.future.length === 0) return state;
      const next = state.future[state.future.length - 1];
      const currentSnapshot = snapshotOf(state.project);
      return {
        project: { ...state.project, scenes: next.scenes, assets: next.assets },
        past: [...state.past, currentSnapshot],
        future: state.future.slice(0, -1),
        selectedElementIds: [],
      };
    }),
}));

function applyEdit(
  set: (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void,
  get: () => EditorState,
  recipe: (draft: Draft<Project>) => void,
): void {
  const state = get();
  if (!state.project) return;
  const prevSnapshot = snapshotOf(state.project);
  const nextProject = produce(state.project, (draft) => {
    recipe(draft);
    draft.updatedAt = new Date().toISOString();
  });
  set((s) => ({
    project: nextProject,
    past: [...s.past.slice(-(MAX_HISTORY - 1)), prevSnapshot],
    future: [],
  }));
}
