import store from "./store.js";

export function initDragAndDrop(containerSelector, onDropComplete) {
  // Delegate events to the roadmap canvas
  const canvas = document.querySelector(containerSelector);
  if (!canvas) return;

  let draggedCardId = null;

  canvas.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".roadmap-card");
    if (!card) return;

    draggedCardId = card.dataset.itemId;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedCardId);
  });

  canvas.addEventListener("dragend", (e) => {
    const card = e.target.closest(".roadmap-card");
    if (card) {
      card.classList.remove("dragging");
    }
    // Clean up all drag-over classes
    canvas.querySelectorAll(".grid-cell").forEach(cell => {
      cell.classList.remove("drag-over");
    });
    draggedCardId = null;
  });

  canvas.addEventListener("dragover", (e) => {
    const cell = e.target.closest(".grid-cell");
    if (!cell) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    // Add dragover visual state
    cell.classList.add("drag-over");
  });

  canvas.addEventListener("dragleave", (e) => {
    const cell = e.target.closest(".grid-cell");
    if (!cell) return;

    // Only remove if we actually leave the cell bounds (not just hovering a card inside it)
    const rect = cell.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom
    ) {
      cell.classList.remove("drag-over");
    }
  });

  canvas.addEventListener("drop", async (e) => {
    const cell = e.target.closest(".grid-cell");
    if (!cell) return;

    e.preventDefault();
    cell.classList.remove("drag-over");

    const itemId = e.dataTransfer.getData("text/plain") || draggedCardId;
    if (!itemId) return;

    const targetPlatId = cell.dataset.platformId;
    const targetPhaseId = cell.dataset.phaseId;

    // Get all cards in this target cell, excluding the currently dragged card (if it's already there)
    const cardElements = Array.from(cell.querySelectorAll(".roadmap-card:not(.dragging)"));
    
    // Find where to insert the dropped card based on y-coordinates
    let insertIndex = cardElements.length;
    for (let i = 0; i < cardElements.length; i++) {
      const cardRect = cardElements[i].getBoundingClientRect();
      const cardMidpoint = cardRect.top + cardRect.height / 2;
      if (e.clientY < cardMidpoint) {
        insertIndex = i;
        break;
      }
    }

    // Build the new ordering list of item IDs
    const otherItemIds = cardElements.map(el => el.dataset.itemId);
    const newOrderedIds = [...otherItemIds];
    newOrderedIds.splice(insertIndex, 0, itemId);

    // Prepare positions updates
    const updates = newOrderedIds.map((id, index) => ({
      id,
      platformId: targetPlatId,
      phaseId: targetPhaseId,
      sortOrder: index + 1
    }));

    // Update positions in bulk
    await store.updateItemPositions(updates);
    
    if (onDropComplete) onDropComplete();
  });
}
