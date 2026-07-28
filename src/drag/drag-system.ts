export interface DragState {
  pointerId: number;
  node: any; // DisplayObject
  from: any; // Container that owns the node
  offsetX: number;
  offsetY: number;
  globalX: number;
  globalY: number;
}

export interface DropTarget {
  acceptsDrop(drag: DragState): boolean;
  receiveDrop(drag: DragState): void;
  getPriority(): number;
}

class DragSystem {
  private activeDrags: Map<number, DragState> = new Map();
  private dropTargets: Set<DropTarget> = new Set();

  registerDropTarget(target: DropTarget): void {
    this.dropTargets.add(target);
  }

  unregisterDropTarget(target: DropTarget): void {
    this.dropTargets.delete(target);
  }

  startDrag(
    pointerId: number,
    node: any,
    from: any,
    offsetX: number,
    offsetY: number,
    globalX: number,
    globalY: number
  ): void {
    this.activeDrags.set(pointerId, {
      pointerId,
      node,
      from,
      offsetX,
      offsetY,
      globalX,
      globalY,
    });
  }

  updateDrag(pointerId: number, globalX: number, globalY: number): void {
    const drag = this.activeDrags.get(pointerId);
    if (!drag) return;

    drag.globalX = globalX;
    drag.globalY = globalY;

    // Move node to follow pointer
    if (drag.node?.position) {
      drag.node.position.x = globalX + drag.offsetX;
      drag.node.position.y = globalY + drag.offsetY;
    }
  }

  endDrag(pointerId: number): DragState | null {
    const drag = this.activeDrags.get(pointerId);
    if (!drag) return null;

    this.activeDrags.delete(pointerId);

    // Find best drop target
    let bestTarget: DropTarget | null = null;
    let bestPriority = -Infinity;

    for (const target of this.dropTargets) {
      if (target.acceptsDrop(drag)) {
        const priority = target.getPriority();
        if (priority > bestPriority) {
          bestPriority = priority;
          bestTarget = target;
        }
      }
    }

    if (bestTarget) {
      bestTarget.receiveDrop(drag);
    }

    return drag;
  }

  hasDrag(pointerId: number): boolean {
    return this.activeDrags.has(pointerId);
  }

  getDrag(pointerId: number): DragState | undefined {
    return this.activeDrags.get(pointerId);
  }
}

export const dragSystem = new DragSystem();
