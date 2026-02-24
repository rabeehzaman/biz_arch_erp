"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
}

interface OpeningStock {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitCost: number;
  stockDate: string;
  notes: string | null;
  stockLot: {
    id: string;
    remainingQuantity: number;
  } | null;
}

export default function OpeningStockPage() {
  const [openingStocks, setOpeningStocks] = useState<OpeningStock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsWithOpeningStock, setProductsWithOpeningStock] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<OpeningStock | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [formData, setFormData] = useState({
    productId: "",
    quantity: "",
    unitCost: "",
    stockDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [stocksResponse, productsResponse] = await Promise.all([
        fetch("/api/opening-stocks"),
        fetch("/api/products?excludeServices=true"),
      ]);

      const stocksData = await stocksResponse.json();
      const productsData = await productsResponse.json();

      setOpeningStocks(stocksData);
      setProducts(productsData);

      // Track which products already have opening stock
      const stockProductIds = new Set<string>(stocksData.map((s: OpeningStock) => s.productId));
      setProductsWithOpeningStock(stockProductIds);
    } catch (error) {
      toast.error("Failed to load data");
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      productId: formData.productId,
      quantity: parseFloat(formData.quantity),
      unitCost: parseFloat(formData.unitCost) || 0,
      stockDate: formData.stockDate,
      notes: formData.notes || null,
    };

    try {
      const response = editingStock
        ? await fetch(`/api/opening-stocks/${editingStock.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        : await fetch("/api/opening-stocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
      toast.success(editingStock ? "Opening stock updated" : "Opening stock added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save opening stock");
      console.error("Failed to save opening stock:", error);
    }
  };

  const handleEdit = (stock: OpeningStock) => {
    setEditingStock(stock);
    setFormData({
      productId: stock.productId,
      quantity: String(stock.quantity),
      unitCost: String(stock.unitCost),
      stockDate: stock.stockDate.split("T")[0],
      notes: stock.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: "Delete Opening Stock",
      description: "Are you sure you want to delete this opening stock entry? This will affect stock calculations.",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/opening-stocks/${id}`, { method: "DELETE" });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to delete");
          }
          fetchData();
          toast.success("Opening stock deleted");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to delete opening stock");
          console.error("Failed to delete opening stock:", error);
        }
      },
    });
  };

  const resetForm = () => {
    setEditingStock(null);
    setFormData({
      productId: "",
      quantity: "",
      unitCost: "",
      stockDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  // Filter products that don't already have opening stock (for new entries)
  const availableProducts = products.filter(
    (p) => !productsWithOpeningStock.has(p.id) || editingStock?.productId === p.id
  );

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Opening Stock</h2>
            <p className="text-slate-500">Set initial stock quantities for your products</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button disabled={availableProducts.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Add Opening Stock
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingStock ? "Edit Opening Stock" : "Add Opening Stock"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingStock
                      ? "Update the opening stock details."
                      : "Enter the initial stock for a product. This will create a stock lot."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="product">Product *</Label>
                    <Select
                      value={formData.productId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, productId: value })
                      }
                      disabled={!!editingStock}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {(editingStock ? products : availableProducts).map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} {product.sku && `(${product.sku})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="quantity">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({ ...formData, quantity: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="unitCost">Unit Cost</Label>
                      <Input
                        id="unitCost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.unitCost}
                        onChange={(e) =>
                          setFormData({ ...formData, unitCost: e.target.value })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="stockDate">Stock Date *</Label>
                    <Input
                      id="stockDate"
                      type="date"
                      value={formData.stockDate}
                      onChange={(e) =>
                        setFormData({ ...formData, stockDate: e.target.value })
                      }
                      required
                    />
                    <p className="text-xs text-slate-500">
                      This date is used for FIFO ordering. Stock from earlier dates will be consumed first.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="Any additional notes..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    {editingStock ? "Update" : "Add Opening Stock"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Opening Stock Entries</CardTitle>
            <CardDescription>
              These are the initial stock quantities that were set when the system started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton columns={7} rows={5} />
            ) : openingStocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">No opening stock entries</h3>
                <p className="text-sm text-slate-500">
                  Add opening stock to set initial quantities for your products
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Opening Qty</TableHead>
                    <TableHead className="text-right">Remaining Qty</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead>Stock Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openingStocks.map((stock) => (
                    <TableRow key={stock.id}>
                      <TableCell className="font-medium">
                        {stock.product.name}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {stock.product.sku || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(stock.quantity)} {typeof stock.product.unit === "object" ? (stock.product.unit as any)?.code : stock.product.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={
                          stock.stockLot && Number(stock.stockLot.remainingQuantity) < Number(stock.quantity)
                            ? "text-orange-600"
                            : ""
                        }>
                          {stock.stockLot ? Number(stock.stockLot.remainingQuantity) : 0} {typeof stock.product.unit === "object" ? (stock.product.unit as any)?.code : stock.product.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{Number(stock.unitCost).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(stock.stockDate), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(stock)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(stock.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      {confirmDialog && (
        <ConfirmDialog
          open={!!confirmDialog}
          onOpenChange={(open) => !open && setConfirmDialog(null)}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
        />
      )}
      </div>
    </PageAnimation>
  );
}
