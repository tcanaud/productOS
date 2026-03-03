/**
 * Tests for Story 7.1: DiagramContextMenu
 *
 * Verifies:
 * - Renders node-specific actions when type="node"
 * - Renders edge-specific actions when type="edge"
 * - Calls onAction + onClose when an action is selected
 * - Calls onClose when Escape is pressed
 * - Calls onClose when the backdrop is clicked
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagramContextMenu } from '@/components/diagram/DiagramContextMenu';
import type { DiagramAction } from '@/components/diagram/DiagramContextMenu';

const POSITION = { x: 100, y: 200 };

describe('DiagramContextMenu — node type', () => {
  it('renders node-specific actions', () => {
    render(
      <DiagramContextMenu
        type="node"
        nodeId="Payment"
        position={POSITION}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Explain node')).toBeInTheDocument();
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Add child node')).toBeInTheDocument();
    expect(screen.getByText('Add parent node')).toBeInTheDocument();
    expect(screen.getByText('Remove node')).toBeInTheDocument();
  });

  it('calls onAction with correct payload when "Rename" is clicked', () => {
    const onAction = vi.fn<[DiagramAction], void>();
    const onClose = vi.fn();

    render(
      <DiagramContextMenu
        type="node"
        nodeId="Payment"
        position={POSITION}
        onAction={onAction}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText('Rename'));
    expect(onAction).toHaveBeenCalledWith({ type: 'rename', nodeId: 'Payment' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onAction with correct payload when "Remove node" is clicked', () => {
    const onAction = vi.fn<[DiagramAction], void>();
    const onClose = vi.fn();

    render(
      <DiagramContextMenu
        type="node"
        nodeId="Auth"
        position={POSITION}
        onAction={onAction}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText('Remove node'));
    expect(onAction).toHaveBeenCalledWith({ type: 'remove-node', nodeId: 'Auth' });
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();

    render(
      <DiagramContextMenu
        type="node"
        nodeId="X"
        position={POSITION}
        onAction={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();

    render(
      <DiagramContextMenu
        type="node"
        nodeId="X"
        position={POSITION}
        onAction={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByTestId('context-menu-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('DiagramContextMenu — edge type', () => {
  it('renders edge-specific actions', () => {
    render(
      <DiagramContextMenu
        type="edge"
        edgeFrom="A"
        edgeTo="B"
        position={POSITION}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Add condition')).toBeInTheDocument();
    expect(screen.getByText('Reverse direction')).toBeInTheDocument();
    expect(screen.getByText('Remove connection')).toBeInTheDocument();
  });

  it('does NOT render node actions for an edge menu', () => {
    render(
      <DiagramContextMenu
        type="edge"
        edgeFrom="A"
        edgeTo="B"
        position={POSITION}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    expect(screen.queryByText('Add child node')).not.toBeInTheDocument();
  });

  it('calls onAction with from/to when "Add condition" is clicked', () => {
    const onAction = vi.fn<[DiagramAction], void>();
    const onClose = vi.fn();

    render(
      <DiagramContextMenu
        type="edge"
        edgeFrom="Start"
        edgeTo="End"
        position={POSITION}
        onAction={onAction}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText('Add condition'));
    expect(onAction).toHaveBeenCalledWith({ type: 'add-condition', from: 'Start', to: 'End' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onAction with from/to when "Remove connection" is clicked', () => {
    const onAction = vi.fn<[DiagramAction], void>();

    render(
      <DiagramContextMenu
        type="edge"
        edgeFrom="A"
        edgeTo="B"
        position={POSITION}
        onAction={onAction}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Remove connection'));
    expect(onAction).toHaveBeenCalledWith({ type: 'remove-connection', from: 'A', to: 'B' });
  });

  it('is positioned at the given coordinates', () => {
    render(
      <DiagramContextMenu
        type="edge"
        edgeFrom="A"
        edgeTo="B"
        position={{ x: 350, y: 450 }}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const menu = screen.getByTestId('diagram-context-menu');
    expect(menu).toHaveStyle({ left: '350px', top: '450px' });
  });
});
