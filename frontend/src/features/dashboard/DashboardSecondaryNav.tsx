import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronRight,
    Plus,
    Folder,
    BarChart3,
    TrendingUp,
    Target,
    Activity,
    LineChart,
    PieChart,
    Zap,
    X,
    FolderPlus,
    Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    listAllCustomDashboards,
    createCustomDashboard,
    deleteCustomDashboard,
} from '@/lib/supabase';

interface DashboardItem {
    id: string;
    label: string;
    slug: string;
    icon?: string;
}

type DashboardTree = Record<string, DashboardItem[]>;

const STORAGE_KEY = 'ladoo:dashboardTree:v2';

const defaultFolders = ['acquisition', 'retention', 'quality'];

const defaultTree: DashboardTree = {
    acquisition: [
        { id: 'r2a', label: 'R2A Analysis', slug: 'r2a' },
        { id: 'r2a-percentage', label: 'R2A Percentage', slug: 'r2a-percentage' },
        { id: 'a2phh', label: 'A2PHH Summary', slug: 'a2phh' },
    ],
    retention: [
        { id: 'fe2net', label: 'FE2Net Funnel', slug: 'fe2net' },
        { id: 'rtu', label: 'RTU Performance', slug: 'rtu' },
    ],
    quality: [
        { id: 'dapr', label: 'Dapr Bucket Distribution', slug: 'dapr' },
    ],
};

const folderIcons: Record<string, typeof Folder> = {
    acquisition: Target,
    retention: TrendingUp,
    quality: Activity,
};

const itemIcons = [BarChart3, LineChart, PieChart, Zap, Activity, TrendingUp];

interface DashboardSecondaryNavProps {
    onNavigate?: () => void;
}

export function DashboardSecondaryNav({ onNavigate }: DashboardSecondaryNavProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const [tree, setTree] = useState<DashboardTree>(defaultTree);
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
        acquisition: true,
        retention: true,
        quality: true,
    });

    // Add Item dialog state
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addingToFolder, setAddingToFolder] = useState<string | null>(null);
    const [newItemLabel, setNewItemLabel] = useState('');
    const [addingItem, setAddingItem] = useState(false);

    // Add Folder dialog state
    const [folderDialogOpen, setFolderDialogOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Load from localStorage + merge Supabase custom dashboards
    useEffect(() => {
        // Start with default tree
        let baseTree = { ...defaultTree };

        // Try loading localStorage cache
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as DashboardTree;
                // Merge: keep default built-in items, add any custom folders/items from cache
                baseTree = mergeTreeWithDefaults(parsed);
            } catch {
                // ignore bad cache
            }
        }
        setTree(baseTree);

        // Fetch from Supabase and merge
        listAllCustomDashboards()
            .then((dashboards) => {
                setTree((prev) => {
                    const merged = { ...prev };
                    for (const db of dashboards) {
                        if (!merged[db.folder]) {
                            merged[db.folder] = [];
                        }
                        const exists = merged[db.folder].some((item) => item.slug === db.slug);
                        if (!exists) {
                            merged[db.folder].push({
                                id: `custom-${db.id}`,
                                label: db.name,
                                slug: db.slug,
                            });
                        }
                    }
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                    // Open any new custom folders
                    setOpenFolders((prev) => {
                        const updated = { ...prev };
                        for (const db of dashboards) {
                            if (!(db.folder in updated)) {
                                updated[db.folder] = true;
                            }
                        }
                        return updated;
                    });
                    return merged;
                });
            })
            .catch(console.error);
    }, []);

    /** Ensure all default built-in items exist in the tree */
    function mergeTreeWithDefaults(cached: DashboardTree): DashboardTree {
        const merged: DashboardTree = {};
        // Start with all default folders
        for (const [folder, items] of Object.entries(defaultTree)) {
            merged[folder] = [...items];
        }
        // Add custom items from cache (including custom folders)
        for (const [folder, items] of Object.entries(cached)) {
            if (!merged[folder]) {
                merged[folder] = [];
            }
            for (const item of items) {
                if (item.id.startsWith('custom-')) {
                    const exists = merged[folder].some((i) => i.slug === item.slug);
                    if (!exists) {
                        merged[folder].push(item);
                    }
                }
            }
        }
        return merged;
    }

    const saveTree = (newTree: DashboardTree) => {
        setTree(newTree);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newTree));
    };

    const toggleFolder = (folder: string) => {
        setOpenFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));
    };

    const openAddDialog = (folder: string) => {
        setAddingToFolder(folder);
        setNewItemLabel('');
        setAddDialogOpen(true);
    };

    const handleAddItem = async () => {
        if (!addingToFolder || !newItemLabel.trim()) return;

        setAddingItem(true);
        const slug = newItemLabel
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        try {
            // Save to Supabase
            const dashboard = await createCustomDashboard(
                newItemLabel.trim(),
                slug,
                addingToFolder
            );

            const newItem: DashboardItem = {
                id: `custom-${dashboard.id}`,
                label: newItemLabel.trim(),
                slug,
            };

            const newTree = {
                ...tree,
                [addingToFolder]: [...(tree[addingToFolder] || []), newItem],
            };

            saveTree(newTree);
            setAddDialogOpen(false);
            setAddingToFolder(null);

            // Navigate to the new dashboard
            navigate(`/dashboard/${addingToFolder}/${slug}`);
            onNavigate?.();
        } catch (error: any) {
            // Handle duplicate slug
            if (error.message?.includes('duplicate') || error.code === '23505') {
                alert('A dashboard with this name already exists in this folder. Please choose a different name.');
            } else {
                console.error('Failed to create dashboard:', error);
                alert('Failed to create dashboard. Make sure the migration has been run.');
            }
        } finally {
            setAddingItem(false);
        }
    };

    const removeItem = async (folder: string, itemId: string) => {
        // Remove from tree immediately
        const newTree = {
            ...tree,
            [folder]: tree[folder].filter((item) => item.id !== itemId),
        };
        saveTree(newTree);

        // Delete from Supabase if it's a custom item
        if (itemId.startsWith('custom-')) {
            const supabaseId = itemId.replace('custom-', '');
            try {
                await deleteCustomDashboard(supabaseId);
            } catch (error) {
                console.error('Failed to delete from Supabase:', error);
            }
        }
    };

    const handleAddFolder = () => {
        if (!newFolderName.trim()) return;

        const folderKey = newFolderName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        if (tree[folderKey]) {
            alert('A folder with this name already exists.');
            return;
        }

        const newTree = { ...tree, [folderKey]: [] };
        saveTree(newTree);
        setOpenFolders((prev) => ({ ...prev, [folderKey]: true }));
        setFolderDialogOpen(false);
        setNewFolderName('');
    };

    const removeFolder = (folderKey: string) => {
        if (defaultFolders.includes(folderKey)) return;
        if (tree[folderKey]?.length > 0) {
            alert('Cannot delete a folder that has items. Remove all items first.');
            return;
        }
        const { [folderKey]: _, ...rest } = tree;
        saveTree(rest);
    };

    const folders = Object.entries(tree) as [string, DashboardItem[]][];

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Dashboard</h2>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                    Configuration
                </p>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                    {folders.map(([folderKey, items]) => {
                        const FolderIcon = folderIcons[folderKey] || Folder;
                        const folderLabel = folderKey
                            .split('-')
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(' ');
                        const isCustomFolder = !defaultFolders.includes(folderKey);

                        return (
                            <Collapsible
                                key={folderKey}
                                open={openFolders[folderKey]}
                                onOpenChange={() => toggleFolder(folderKey)}
                            >
                                <div className="flex items-center group">
                                    <CollapsibleTrigger asChild>
                                        <button className="flex items-center gap-2 flex-1 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                                            <ChevronRight
                                                className={cn(
                                                    'h-4 w-4 text-muted-foreground transition-transform',
                                                    openFolders[folderKey] && 'rotate-90'
                                                )}
                                            />
                                            <FolderIcon className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium flex-1 text-left">
                                                {folderLabel}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {items.length}
                                            </span>
                                        </button>
                                    </CollapsibleTrigger>
                                    {isCustomFolder && items.length === 0 && (
                                        <button
                                            onClick={() => removeFolder(folderKey)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity mr-1"
                                            title="Delete empty folder"
                                        >
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                        </button>
                                    )}
                                </div>

                                <CollapsibleContent className="pl-6 space-y-1 mt-1">
                                    {items.map((item, index) => {
                                        const ItemIcon = itemIcons[index % itemIcons.length];
                                        const isActive =
                                            location.pathname ===
                                            `/dashboard/${folderKey}/${item.slug}`;

                                        return (
                                            <div key={item.id} className="flex items-center group">
                                                <NavLink
                                                    to={`/dashboard/${folderKey}/${item.slug}`}
                                                    onClick={onNavigate}
                                                    className={cn(
                                                        'flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md text-sm transition-colors',
                                                        isActive
                                                            ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                                    )}
                                                >
                                                    <ItemIcon className="h-3.5 w-3.5" />
                                                    <span className="truncate">{item.label}</span>
                                                </NavLink>
                                                {item.id.startsWith('custom-') && (
                                                    <button
                                                        onClick={() =>
                                                            removeItem(folderKey, item.id)
                                                        }
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                                                    >
                                                        <X className="h-3 w-3 text-destructive" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Add Item Button */}
                                    <button
                                        onClick={() => openAddDialog(folderKey)}
                                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span>Add item</span>
                                    </button>
                                </CollapsibleContent>
                            </Collapsible>
                        );
                    })}

                    {/* Add Folder Button */}
                    <button
                        onClick={() => {
                            setNewFolderName('');
                            setFolderDialogOpen(true);
                        }}
                        className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                        <FolderPlus className="h-4 w-4" />
                        <span>New folder</span>
                    </button>
                </div>
            </ScrollArea>

            {/* Add Item Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Add Dashboard Item</DialogTitle>
                        <DialogDescription>
                            Add a new custom dashboard to the{' '}
                            <span className="font-medium capitalize">
                                {addingToFolder?.replace(/-/g, ' ')}
                            </span>{' '}
                            folder. You can configure the SQL query on the dashboard page.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="label">Name</Label>
                            <Input
                                id="label"
                                value={newItemLabel}
                                onChange={(e) => setNewItemLabel(e.target.value)}
                                placeholder="My Custom Dashboard"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newItemLabel.trim()) {
                                        handleAddItem();
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddItem}
                            disabled={!newItemLabel.trim() || addingItem}
                        >
                            {addingItem ? 'Creating...' : 'Create Dashboard'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Folder Dialog */}
            <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>New Folder</DialogTitle>
                        <DialogDescription>
                            Create a new folder to organize your dashboards.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="folderName">Folder Name</Label>
                            <Input
                                id="folderName"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Geo Analysis"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newFolderName.trim()) {
                                        handleAddFolder();
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddFolder} disabled={!newFolderName.trim()}>
                            Create Folder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Footer */}
            <div className="p-4 border-t">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                        saveTree(defaultTree);
                        setOpenFolders({
                            acquisition: true,
                            retention: true,
                            quality: true,
                        });
                    }}
                >
                    Reset to Default
                </Button>
            </div>
        </div>
    );
}
