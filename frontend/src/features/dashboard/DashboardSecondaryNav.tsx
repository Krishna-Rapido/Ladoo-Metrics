import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
    DialogTrigger,
} from '@/components/ui/dialog';

interface DashboardItem {
    id: string;
    label: string;
    slug: string;
    icon?: string;
}

interface DashboardTree {
    acquisition: DashboardItem[];
    retention: DashboardItem[];
    quality: DashboardItem[];
}

const STORAGE_KEY = 'ladoo:dashboardTree:v1';

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
    const [tree, setTree] = useState<DashboardTree>(defaultTree);
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
        acquisition: true,
        retention: true,
        quality: true,
    });
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addingToFolder, setAddingToFolder] = useState<keyof DashboardTree | null>(null);
    const [newItemLabel, setNewItemLabel] = useState('');
    const [newItemSlug, setNewItemSlug] = useState('');

    // Load from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setTree(parsed);
            } catch {
                setTree(defaultTree);
            }
        }
    }, []);

    // Save to localStorage
    const saveTree = (newTree: DashboardTree) => {
        setTree(newTree);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newTree));
    };

    const toggleFolder = (folder: string) => {
        setOpenFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));
    };

    const openAddDialog = (folder: keyof DashboardTree) => {
        setAddingToFolder(folder);
        setNewItemLabel('');
        setNewItemSlug('');
        setAddDialogOpen(true);
    };

    const handleAddItem = () => {
        if (!addingToFolder || !newItemLabel.trim()) return;

        const slug = newItemSlug.trim() || newItemLabel.toLowerCase().replace(/\s+/g, '-');
        const newItem: DashboardItem = {
            id: `custom-${Date.now()}`,
            label: newItemLabel.trim(),
            slug,
        };

        const newTree = {
            ...tree,
            [addingToFolder]: [...tree[addingToFolder], newItem],
        };

        saveTree(newTree);
        setAddDialogOpen(false);
        setAddingToFolder(null);
    };

    const removeItem = (folder: keyof DashboardTree, itemId: string) => {
        const newTree = {
            ...tree,
            [folder]: tree[folder].filter((item) => item.id !== itemId),
        };
        saveTree(newTree);
    };

    const folders = Object.entries(tree) as [keyof DashboardTree, DashboardItem[]][];

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
                        const folderLabel = folderKey.charAt(0).toUpperCase() + folderKey.slice(1);

                        return (
                            <Collapsible
                                key={folderKey}
                                open={openFolders[folderKey]}
                                onOpenChange={() => toggleFolder(folderKey)}
                            >
                                <CollapsibleTrigger asChild>
                                    <button className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors group">
                                        <ChevronRight
                                            className={cn(
                                                'h-4 w-4 text-muted-foreground transition-transform',
                                                openFolders[folderKey] && 'rotate-90'
                                            )}
                                        />
                                        <FolderIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium flex-1 text-left">{folderLabel}</span>
                                        <span className="text-xs text-muted-foreground">{items.length}</span>
                                    </button>
                                </CollapsibleTrigger>

                                <CollapsibleContent className="pl-6 space-y-1 mt-1">
                                    {items.map((item, index) => {
                                        const ItemIcon = itemIcons[index % itemIcons.length];
                                        const isActive = location.pathname === `/dashboard/${folderKey}/${item.slug}`;

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
                                                        onClick={() => removeItem(folderKey, item.id)}
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
                </div>
            </ScrollArea>

            {/* Add Item Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Add Dashboard Item</DialogTitle>
                        <DialogDescription>
                            Add a new item to the {addingToFolder} folder.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="label">Label</Label>
                            <Input
                                id="label"
                                value={newItemLabel}
                                onChange={(e) => setNewItemLabel(e.target.value)}
                                placeholder="My Custom Dashboard"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="slug">Route Slug (optional)</Label>
                            <Input
                                id="slug"
                                value={newItemSlug}
                                onChange={(e) => setNewItemSlug(e.target.value)}
                                placeholder="my-custom-dashboard"
                            />
                            <p className="text-xs text-muted-foreground">
                                Leave empty to auto-generate from label
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddItem} disabled={!newItemLabel.trim()}>
                            Add Item
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
                    }}
                >
                    Reset to Default
                </Button>
            </div>
        </div>
    );
}
