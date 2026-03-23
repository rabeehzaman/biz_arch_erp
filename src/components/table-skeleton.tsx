import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="rounded-lg border bg-card p-4 space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-24" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <TableCell key={colIndex}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-3">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  );
}

export function ListPageSkeleton({ columns = 7, rows = 5 }: { columns?: number; rows?: number } = {}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded bg-slate-200 animate-shimmer" />
          <div className="h-4 w-56 rounded bg-slate-100 animate-shimmer" />
        </div>
        <div className="h-10 w-36 rounded bg-slate-200 animate-shimmer" />
      </div>
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <div className="h-10 w-64 rounded bg-slate-100 animate-shimmer" />
        </div>
        <div className="p-6">
          <TableSkeleton columns={columns} rows={rows} />
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="rounded-lg border bg-card">
        <div className="p-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <TableSkeleton columns={5} rows={5} />
        </div>
      </div>
    </div>
  );
}
