import { useState } from 'react';
import { useAppState } from '@/store/AppContext';
import { ProductGroup } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Search, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductGroupManager() {
  const { state, dispatch } = useAppState();
  const { products, productGroups } = state;

  const [editing, setEditing] = useState<ProductGroup | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const filteredProducts = products.filter(p =>
    p.item_id.toLowerCase().includes(search.toLowerCase()) ||
    p.item_name.toLowerCase().includes(search.toLowerCase())
  );

  const startCreate = () => {
    setIsCreating(true);
    setEditing(null);
    setName('');
    setDescription('');
    setSelectedIds(new Set());
    setSearch('');
  };

  const startEdit = (group: ProductGroup) => {
    setEditing(group);
    setIsCreating(false);
    setName(group.name);
    setDescription(group.description);
    setSelectedIds(new Set(group.product_ids));
    setSearch('');
  };

  const cancel = () => {
    setIsCreating(false);
    setEditing(null);
    setName('');
    setDescription('');
    setSelectedIds(new Set());
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error('กรุณาใส่ชื่อกลุ่ม'); return; }
    if (selectedIds.size === 0) { toast.error('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'); return; }

    if (editing) {
      const updated: ProductGroup = {
        ...editing,
        name: name.trim(),
        description: description.trim(),
        product_ids: Array.from(selectedIds),
      };
      dispatch({ type: 'UPDATE_PRODUCT_GROUP', payload: updated });
      toast.success(`อัปเดตกลุ่ม "${updated.name}" แล้ว`);
    } else {
      const group: ProductGroup = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim(),
        product_ids: Array.from(selectedIds),
        created_at: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_PRODUCT_GROUP', payload: group });
      toast.success(`สร้างกลุ่ม "${group.name}" แล้ว`);
    }
    cancel();
  };

  const handleDelete = (group: ProductGroup) => {
    dispatch({ type: 'DELETE_PRODUCT_GROUP', payload: group.id });
    toast.success(`ลบกลุ่ม "${group.name}" แล้ว`);
  };

  const toggleProduct = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isFormOpen = isCreating || editing !== null;

  if (products.length === 0) {
    return (
      <div className="metric-card text-center py-16 animate-fade-in">
        <h3 className="text-lg font-semibold mb-2">ไม่มีสินค้า</h3>
        <p className="text-muted-foreground text-sm">นำเข้าสินค้าจากหน้า Product Master ก่อน</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">จัดการกลุ่มสินค้า</h2>
          <p className="text-muted-foreground text-sm mt-1">สร้างกลุ่มสินค้าเพื่อใช้ใน Scenario Creator</p>
        </div>
        {!isFormOpen && (
          <Button size="sm" onClick={startCreate}>
            <Plus size={14} />
            สร้างกลุ่มใหม่
          </Button>
        )}
      </div>

      {/* Form */}
      {isFormOpen && (
        <div className="metric-card space-y-4">
          <h3 className="section-header">{editing ? `แก้ไข: ${editing.name}` : 'สร้างกลุ่มใหม่'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">ชื่อกลุ่ม *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น สินค้าหมวด A" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">คำอธิบาย</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="รายละเอียดเพิ่มเติม" className="mt-1" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">เลือกสินค้า ({selectedIds.size} รายการ)</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <Input placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 w-48" />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {filteredProducts.map(p => (
                <label key={p.item_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer border-b last:border-b-0">
                  <Checkbox checked={selectedIds.has(p.item_id)} onCheckedChange={() => toggleProduct(p.item_id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{p.item_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.item_id}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={cancel}><X size={14} /> ยกเลิก</Button>
            <Button size="sm" onClick={handleSave}><Save size={14} /> {editing ? 'อัปเดต' : 'บันทึก'}</Button>
          </div>
        </div>
      )}

      {/* Group list */}
      {productGroups.length === 0 && !isFormOpen ? (
        <div className="metric-card text-center py-12">
          <p className="text-muted-foreground text-sm">ยังไม่มีกลุ่มสินค้า กดปุ่ม "สร้างกลุ่มใหม่" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {productGroups.map(group => (
            <div key={group.id} className="metric-card">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold">{group.name}</h4>
                  {group.description && <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(group)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(group)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">{group.product_ids.length} สินค้า</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {group.product_ids.slice(0, 5).map(id => {
                  const p = products.find(pr => pr.item_id === id);
                  return p ? (
                    <span key={id} className="inline-block text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full truncate max-w-[120px]">
                      {p.item_name}
                    </span>
                  ) : null;
                })}
                {group.product_ids.length > 5 && (
                  <span className="text-xs text-muted-foreground">+{group.product_ids.length - 5} อื่นๆ</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
