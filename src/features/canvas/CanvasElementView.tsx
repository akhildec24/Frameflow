import { Group, Image as KonvaImage, Rect, Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import { useEffect, useRef } from 'react';
import type { CaptionConfig, Element, Project } from '../../lib/types';
import { useMediaSource } from './useMediaSource';
import { clamp, computeContainRect, computeFillCrop, cropToPixels } from '../../lib/geometry';
import { CAPTION_TEXT_FILL, captionLayout, resolveCaptionText } from '../../lib/captions';

interface CanvasElementViewProps {
  element: Element;
  project: Project;
  isSelected: boolean;
  isCropEditing: boolean;
  onSelect: (additive: boolean) => void;
  onDragMove: (dx: number, dy: number) => void;
  onDragEnd: () => void;
  onDragStartCapture: () => void;
  onCropPanChange: (pan: { x: number; y: number }) => void;
  onDoubleClickText: () => void;
  registerNode: (node: Konva.Group | null) => void;
}

export function CanvasElementView({
  element,
  project,
  isSelected,
  isCropEditing,
  onSelect,
  onDragMove,
  onDragEnd,
  onDragStartCapture,
  onCropPanChange,
  onDoubleClickText,
  registerNode,
}: CanvasElementViewProps) {
  const dragOrigin = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0.5, y: 0.5 });
  const groupRef = useRef<Konva.Group | null>(null);
  const { transform } = element;

  const asset = element.kind === 'media' ? project.assets[element.assetId] : undefined;
  const source = useMediaSource(asset);
  const captionText = resolveCaptionText(element, asset);
  const isVideoSource = source instanceof HTMLVideoElement;

  // Konva only repaints on demand — a playing video needs a per-frame redraw.
  useEffect(() => {
    if (!isVideoSource) return undefined;
    const layer = groupRef.current?.getLayer();
    if (!layer) return undefined;
    const anim = new Konva.Animation(() => {}, layer);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [isVideoSource]);

  if (element.hidden) return null;

  const natural =
    source != null
      ? {
          width: 'videoWidth' in source ? source.videoWidth || transform.width : source.naturalWidth || transform.width,
          height: 'videoHeight' in source ? source.videoHeight || transform.height : source.naturalHeight || transform.height,
        }
      : null;

  const fillCrop =
    natural && transform.fit !== 'contain'
      ? computeFillCrop(natural, { width: transform.width, height: transform.height }, transform.pan?.x ?? 0.5, transform.pan?.y ?? 0.5, transform.zoom ?? 1)
      : null;

  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragStartCapture();
    dragOrigin.current = { x: e.target.x(), y: e.target.y() };
    panOrigin.current = { x: transform.pan?.x ?? 0.5, y: transform.pan?.y ?? 0.5 };
  };

  const handleGroupDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    if (isCropEditing && natural && fillCrop) {
      const dx = node.x() - dragOrigin.current.x;
      const dy = node.y() - dragOrigin.current.y;
      node.position(dragOrigin.current);

      const spanX = 1 - fillCrop.width;
      const spanY = 1 - fillCrop.height;
      const fractionDx = (dx * fillCrop.width) / Math.max(1, transform.width);
      const fractionDy = (dy * fillCrop.height) / Math.max(1, transform.height);
      const nextPanX = spanX > 0.0001 ? clamp(panOrigin.current.x - fractionDx / spanX, 0, 1) : 0.5;
      const nextPanY = spanY > 0.0001 ? clamp(panOrigin.current.y - fractionDy / spanY, 0, 1) : 0.5;
      onCropPanChange({ x: nextPanX, y: nextPanY });
      return;
    }
    onDragMove(node.x() - transform.x, node.y() - transform.y);
  };

  const flip = {
    scaleX: transform.flipX ? -1 : 1,
    scaleY: transform.flipY ? -1 : 1,
    offsetX: transform.flipX ? transform.width : 0,
    offsetY: transform.flipY ? transform.height : 0,
  };

  return (
    <Group
      ref={(node) => {
        registerNode(node);
        groupRef.current = node;
      }}
      id={element.id}
      x={transform.x}
      y={transform.y}
      rotation={transform.rotation}
      opacity={element.opacity}
      draggable={!element.locked}
      onDragStart={handleDragStart}
      onDragMove={handleGroupDragMove}
      onDragEnd={onDragEnd}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey);
      }}
      onTap={() => onSelect(false)}
      onDblClick={() => element.kind === 'text' && onDoubleClickText()}
    >
      {element.kind === 'media' ? (
        <>
          <MediaContent
            source={source}
            natural={natural}
            width={transform.width}
            height={transform.height}
            fit={transform.fit}
            fillCrop={fillCrop}
            flip={flip}
            isCropEditing={isCropEditing && isSelected}
            status={asset?.status}
          />
          {captionText && element.caption ? (
            <CaptionOverlay text={captionText} width={transform.width} height={transform.height} config={element.caption} />
          ) : null}
        </>
      ) : (
        <KonvaText
          text={element.content}
          width={transform.width}
          height={transform.height}
          fontFamily={element.style.fontFamily}
          fontSize={element.style.fontSize}
          fontStyle={element.style.fontWeight >= 600 ? 'bold' : 'normal'}
          fill={element.style.colour}
          align={element.style.align === 'centre' ? 'center' : element.style.align}
          lineHeight={element.style.lineHeight}
          letterSpacing={element.style.letterSpacing * element.style.fontSize}
          {...flip}
        />
      )}
    </Group>
  );
}

interface MediaContentProps {
  source: HTMLImageElement | HTMLVideoElement | null;
  natural: { width: number; height: number } | null;
  width: number;
  height: number;
  fit: Element['transform']['fit'];
  fillCrop: { x: number; y: number; width: number; height: number } | null;
  flip: { scaleX: number; scaleY: number; offsetX: number; offsetY: number };
  isCropEditing: boolean;
  status?: string;
}

interface CaptionOverlayProps {
  text: string;
  width: number;
  height: number;
  config: CaptionConfig;
}

function CaptionOverlay({ text, width, height, config }: CaptionOverlayProps) {
  const box = captionLayout(width, height, config, text);
  return (
    <Group listening={false}>
      <Rect
        x={box.bar.x}
        y={box.bar.y}
        width={box.bar.width}
        height={box.bar.height}
        cornerRadius={box.bar.radius}
        fill={box.barGradient ? undefined : box.barFill}
        stroke={box.barStroke}
        strokeWidth={box.barStroke ? 1 : 0}
        fillLinearGradientStartPoint={box.barGradient ? { x: box.barGradient.startX, y: box.barGradient.startY } : undefined}
        fillLinearGradientEndPoint={box.barGradient ? { x: box.barGradient.endX, y: box.barGradient.endY } : undefined}
        fillLinearGradientColorStops={box.barGradient?.stops}
      />
      <KonvaText
        x={box.text.x}
        y={box.text.y}
        width={box.text.width}
        height={box.text.height}
        text={text}
        fontFamily={box.fontFamily}
        fontSize={box.fontSize}
        fontStyle="500"
        fill={CAPTION_TEXT_FILL}
        align={box.textAlign}
        verticalAlign="middle"
        wrap="none"
        ellipsis
      />
    </Group>
  );
}

function MediaContent({ source, natural, width, height, fit, fillCrop, flip, isCropEditing, status }: MediaContentProps) {
  if (status === 'error') {
    return <Rect width={width} height={height} fill="#EFEBDF" stroke="#D6D1C6" dash={[4, 4]} />;
  }

  if (!source || !natural) {
    return <Rect width={width} height={height} fill="#EFEBDF" />;
  }

  if (fit === 'contain') {
    const rect = computeContainRect(natural, { width, height });
    return <KonvaImage image={source} x={rect.x} y={rect.y} width={rect.width} height={rect.height} />;
  }

  const cropPx = cropToPixels(fillCrop!, natural);

  return (
    <>
      <KonvaImage
        image={source}
        width={width}
        height={height}
        crop={cropPx}
        scaleX={flip.scaleX}
        scaleY={flip.scaleY}
        offsetX={flip.offsetX}
        offsetY={flip.offsetY}
      />
      {isCropEditing ? (
        <Rect width={width} height={height} stroke="#C66F42" strokeWidth={1.5} dash={[4, 4]} />
      ) : null}
    </>
  );
}
