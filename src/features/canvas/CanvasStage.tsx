import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Rect, Stage, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useEditorStore } from '../../state/editorStore';
import { useElementSize } from '../../lib/useElementSize';
import { CanvasElementView } from './CanvasElementView';
import { TextEditOverlay } from './TextEditOverlay';
import { ASSET_DRAG_MIME } from '../media/AssetThumbnail';
import { collectDroppedFiles } from '../../lib/dropFiles';
import { importAssetFile } from '../../storage/assetRepository';
import { useToast } from '../../components/ui/useToast';
import type { MediaAsset } from '../../lib/types';

const CANVAS_PADDING = 48;

export function CanvasStage() {
  const project = useEditorStore((s) => s.project);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const cropEditingElementId = useEditorStore((s) => s.cropEditingElementId);
  const toggleSelect = useEditorStore((s) => s.toggleSelect);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const updateElement = useEditorStore((s) => s.updateElement);
  const updateElementLive = useEditorStore((s) => s.updateElementLive);
  const beginTransaction = useEditorStore((s) => s.beginTransaction);
  const commitTransaction = useEditorStore((s) => s.commitTransaction);
  const addMediaElementAction = useEditorStore((s) => s.addMediaElement);
  const addAssets = useEditorStore((s) => s.addAssets);
  const renameAsset = useEditorStore((s) => s.renameAsset);
  const { show } = useToast();

  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeMap = useRef<Map<string, Konva.Group>>(new Map());
  const txnRef = useRef<ReturnType<typeof beginTransaction>>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const scene = useMemo(
    () => project?.scenes.find((s) => s.id === project.activeSceneId) ?? project?.scenes[0],
    [project],
  );

  const scale = useMemo(() => {
    if (!project || size.width === 0 || size.height === 0) return 1;
    const availW = Math.max(40, size.width - CANVAS_PADDING * 2);
    const availH = Math.max(40, size.height - CANVAS_PADDING * 2);
    return Math.min(availW / project.width, availH / project.height, 1.5);
  }, [project, size]);

  const offset = useMemo(() => {
    if (!project) return { x: 0, y: 0 };
    return {
      x: (size.width - project.width * scale) / 2,
      y: (size.height - project.height * scale) / 2,
    };
  }, [project, size, scale]);

  const registerNode = useCallback((id: string) => (node: Konva.Group | null) => {
    if (node) nodeMap.current.set(id, node);
    else nodeMap.current.delete(id);
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    if (selectedElementIds.length === 1 && !cropEditingElementId) {
      const node = nodeMap.current.get(selectedElementIds[0]);
      const element = scene?.elements.find((el) => el.id === selectedElementIds[0]);
      if (node && element && !element.locked) {
        transformer.nodes([node]);
      } else {
        transformer.nodes([]);
      }
    } else {
      transformer.nodes([]);
    }
    transformer.getLayer()?.batchDraw();
  }, [selectedElementIds, cropEditingElementId, scene]);

  if (!project || !scene) return null;

  const handleTransformEnd = (elementId: string) => {
    const node = nodeMap.current.get(elementId);
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    updateElement(elementId, (el) => {
      el.transform.x = node.x();
      el.transform.y = node.y();
      el.transform.rotation = node.rotation();
      el.transform.width = Math.max(12, el.transform.width * scaleX);
      el.transform.height = Math.max(12, el.transform.height * scaleY);
    });
  };

  const toProjectPoint = (clientX: number, clientY: number) => {
    const bounds = stageRef.current?.container().getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: (clientX - bounds.left - offset.x) / scale,
      y: (clientY - bounds.top - offset.y) / scale,
    };
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-canvas-surround"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const assetId = e.dataTransfer.getData(ASSET_DRAG_MIME);
        const asset = assetId ? project.assets[assetId] : undefined;
        if (asset) {
          const point = toProjectPoint(e.clientX, e.clientY);
          addMediaElementAction(asset, point);
          return;
        }
        if (!e.dataTransfer.types.includes('Files')) return;
        const dropPoint = toProjectPoint(e.clientX, e.clientY);
        void collectDroppedFiles(e.dataTransfer).then(async (files) => {
          if (!files.length) {
            show({ title: 'Nothing to import', description: 'No supported media files were found in what you dropped.', tone: 'info' });
            return;
          }
          const existingHashes = new Map<string, MediaAsset>();
          for (const a of Object.values(project.assets)) if (a.hash) existingHashes.set(a.hash, a);
          const results: MediaAsset[] = [];
          for (const file of files) {
            const result = await importAssetFile(file, existingHashes);
            if (result.duplicateOfExisting) {
              if (result.asset.name !== file.name) renameAsset(result.asset.id, file.name);
              continue;
            }
            results.push(result.asset);
            if (result.asset.hash) existingHashes.set(result.asset.hash, result.asset);
          }
          if (!results.length) return;
          addAssets(results);
          const ready = results.filter((a) => a.status === 'ready' && a.type !== 'audio');
          // A single dropped file lands at the pointer; batches just join the library.
          if (ready.length === 1) addMediaElementAction(ready[0], dropPoint);
          show({ title: 'Media imported', description: `${results.length} file(s) added to the library.`, tone: 'success' });
        });
      }}
    >
      <Stage
        ref={stageRef}
        width={size.width || 1}
        height={size.height || 1}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) clearSelection();
        }}
      >
        <Layer x={offset.x} y={offset.y} scaleX={scale} scaleY={scale}>
          <Rect
            x={0}
            y={0}
            width={project.width}
            height={project.height}
            fill={scene.background || '#FFFFFF'}
            shadowColor="rgba(35,31,26,0.25)"
            shadowBlur={24}
            shadowOpacity={0.5}
          />
          {[...scene.elements]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((element) => (
              <CanvasElementView
                key={element.id}
                element={element}
                project={project}
                isSelected={selectedElementIds.includes(element.id)}
                isCropEditing={cropEditingElementId === element.id}
                registerNode={registerNode(element.id)}
                onSelect={(additive) => toggleSelect(element.id, additive)}
                onDragStartCapture={() => {
                  txnRef.current = beginTransaction();
                }}
                onDragMove={(dx, dy) => {
                  updateElementLive(element.id, (el) => {
                    el.transform.x += dx;
                    el.transform.y += dy;
                  });
                }}
                onDragEnd={() => {
                  commitTransaction(txnRef.current);
                  txnRef.current = null;
                }}
                onCropPanChange={(pan) => {
                  updateElementLive(element.id, (el) => {
                    if (el.kind === 'media') el.transform.pan = pan;
                  });
                }}
                onDoubleClickText={() => setEditingTextId(element.id)}
              />
            ))}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            flipEnabled={false}
            borderStroke="#C66F42"
            anchorStroke="#C66F42"
            anchorFill="#FBFAF7"
            anchorSize={8}
            anchorCornerRadius={2}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 || newBox.height < 20 ? oldBox : newBox)}
            onTransformEnd={() => {
              const node = transformerRef.current?.nodes()[0];
              if (node) handleTransformEnd(node.id());
            }}
          />
        </Layer>
      </Stage>

      {editingTextId ? (
        <TextEditOverlay
          elementId={editingTextId}
          scene={scene}
          scale={scale}
          offset={offset}
          onClose={() => setEditingTextId(null)}
        />
      ) : null}
    </div>
  );
}
