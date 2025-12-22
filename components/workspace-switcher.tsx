'use client';

import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Plus, Settings2 } from 'lucide-react';
import { toast } from './toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Workspace {
  id: string;
  name: string;
}

interface WorkspaceSwitcherProps {
  currentWorkspaceId: string | null;
  onWorkspaceChange: (workspaceId: string) => void;
}

export function WorkspaceSwitcher({
  currentWorkspaceId,
  onWorkspaceChange,
}: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [renameWorkspaceName, setRenameWorkspaceName] = useState('');
  const [renameWorkspaceId, setRenameWorkspaceId] = useState<string | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  // Fetch workspaces
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (!res.ok) return;
      const data = await res.json();
      setWorkspaces(data.workspaces || []);
      setLoading(false);
    } catch (error) {
      console.error('[WorkspaceSwitcher] Failed to fetch workspaces:', error);
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast({
        type: 'error',
        description: 'Workspace name cannot be empty',
      });
      return;
    }

    setCreating(true);

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({
          type: 'error',
          description: data.message || 'Failed to create workspace',
        });
        setCreating(false);
        return;
      }

      const data = await res.json();
      toast({
        type: 'success',
        description: 'Workspace created successfully',
      });

      // Refresh workspaces list
      await fetchWorkspaces();

      // Switch to the new workspace
      onWorkspaceChange(data.workspace.id);

      setShowCreateDialog(false);
      setNewWorkspaceName('');
      setCreating(false);
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to create workspace',
      });
      setCreating(false);
    }
  };

  const handleRenameWorkspace = async () => {
    if (!renameWorkspaceName.trim()) {
      toast({
        type: 'error',
        description: 'Workspace name cannot be empty',
      });
      return;
    }

    if (!renameWorkspaceId) return;

    setRenaming(true);

    try {
      const res = await fetch(`/api/workspaces/${renameWorkspaceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: renameWorkspaceName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({
          type: 'error',
          description: data.message || 'Failed to rename workspace',
        });
        setRenaming(false);
        return;
      }

      toast({
        type: 'success',
        description: 'Workspace renamed successfully',
      });

      // Refresh workspaces list
      await fetchWorkspaces();

      setShowRenameDialog(false);
      setRenameWorkspaceName('');
      setRenameWorkspaceId(null);
      setRenaming(false);
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to rename workspace',
      });
      setRenaming(false);
    }
  };

  const openRenameDialog = (workspace: Workspace) => {
    setRenameWorkspaceId(workspace.id);
    setRenameWorkspaceName(workspace.name);
    setShowRenameDialog(true);
  };

  if (loading) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 px-3 py-2 hover:bg-muted-foreground/10 rounded-md transition-colors w-full text-left"
            type="button"
          >
            <span className="flex-1 font-medium truncate text-sm">
              {currentWorkspace?.name || 'Select workspace'}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => {
                if (workspace.id !== currentWorkspaceId) {
                  onWorkspaceChange(workspace.id);
                }
              }}
              className="flex items-center justify-between"
            >
              <span className="truncate">{workspace.name}</span>
              {workspace.id === currentWorkspaceId && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowCreateDialog(true)}
            className="text-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create workspace
          </DropdownMenuItem>
          {currentWorkspace && (
            <DropdownMenuItem
              onClick={() => openRenameDialog(currentWorkspace)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Rename workspace
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Workspace Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Enter a name for your new workspace
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                placeholder="My Workspace"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateWorkspace();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setNewWorkspaceName('');
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateWorkspace} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Workspace Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Workspace</DialogTitle>
            <DialogDescription>
              Enter a new name for this workspace
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-workspace-name">Workspace Name</Label>
              <Input
                id="rename-workspace-name"
                placeholder="My Workspace"
                value={renameWorkspaceName}
                onChange={(e) => setRenameWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameWorkspace();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRenameDialog(false);
                setRenameWorkspaceName('');
                setRenameWorkspaceId(null);
              }}
              disabled={renaming}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameWorkspace} disabled={renaming}>
              {renaming ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
