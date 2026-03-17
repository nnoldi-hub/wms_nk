// ============================================================
// Operator Mode — State Machine Types
// ============================================================

export type WorkflowType = 'RECEPTIE' | 'PUTAWAY' | 'PICKING' | 'LIVRARE';

export type ScanStep =
  | 'IDLE'
  | 'SCAN_PRODUCT'
  | 'CONFIRM_PRODUCT'
  | 'SCAN_LOCATION'
  | 'CONFIRM_QUANTITY'
  | 'CONFIRM_ACTION'
  | 'SHOW_TASK'
  | 'SHOW_JOBS'
  | 'SHOW_ITEM'
  | 'JOB_COMPLETE'
  | 'SUCCESS'
  | 'ERROR';

export interface WorkflowState {
  step: ScanStep;
  workflow: WorkflowType | null;
  scannedCode: string | null;
  resolvedProduct: ResolvedProduct | null;
  resolvedLocation: ResolvedLocation | null;
  resolvedTask: PutawayTask | null;
  resolvedJob: PickJob | null;
  quantity: number;
  message: string;
  submessage?: string;
  errorMessage?: string;
}

export interface ResolvedProduct {
  id: string;
  sku: string;
  name: string;
  unit?: string;
  currentStock?: number;
  poNumber?: string;
  poId?: string;
  expectedQty?: number;
  batchNumber?: string;
}

export interface ResolvedLocation {
  id: string;
  code: string;
  zone?: string;
  rack?: string;
  level?: string;
  position?: string;
  currentOccupancy?: number;
  maxCapacity?: number;
}

export interface PutawayTask {
  id: string;
  batchId: string;
  batchNumber: string;
  productSku: string;
  productName: string;
  quantity: number;
  unit: string;
  suggestedLocationId: string | null;
  suggestedLocationCode: string | null;
  taskIndex: number;
  totalTasks: number;
}

export interface PickJob {
  id: string;
  jobNumber: string;
  orderNumber?: string;
  status: string;
  items: PickJobItem[];
  currentItemIndex: number;
}

export interface PickJobItem {
  id: string;
  productSku: string;
  productName: string;
  quantity: number;
  pickedQty: number;
  unit: string;
  locationCode: string;
  locationId: string;
  batchId: string;
  batchNumber: string;
  status: string;
}
