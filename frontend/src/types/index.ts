export type UserRole = 'ADMIN' | 'SALES';
export type MeetingType = 'VISIT' | 'CALL' | 'ONLINE' | 'TRIAL_SUPPORT' | 'QUOTATION_DISCUSSION' | 'TECHNICAL_DISCUSSION';
export type MeetingStatus = 'NEW_LEAD' | 'FOLLOW_UP_PENDING' | 'TRIAL_PLANNED' | 'TRIAL_COMPLETED' | 'QUOTATION_SUBMITTED' | 'WAITING_APPROVAL' | 'NEGOTIATION' | 'PURCHASE_ORDER' | 'LOST' | 'CLOSED';
export type LeaveType = 'CASUAL' | 'SICK' | 'PERMISSION' | 'HALF_DAY';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  contactNumber: string;
  designation?: string;
  email?: string;
  location?: string;
  mapsLink?: string;
  category?: string;
  industryType?: string;
  remarks?: string;
  isActive: boolean;
  createdById: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  meetings?: Meeting[];
  _count?: { meetings: number };
}

export interface Meeting {
  id: string;
  customerId: string;
  customer?: Pick<Customer, 'id' | 'companyName' | 'contactPerson' | 'contactNumber'>;
  userId: string;
  user?: { id: string; name: string };
  meetingDate: string;
  meetingType: MeetingType;
  status: MeetingStatus;
  notes?: string;
  summary?: string;
  actionItems?: string;
  nextFollowUp?: string;
  trialDate?: string;
  trialStatus?: string;
  trialFeedback?: string;
  quotationDate?: string;
  quotationStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  itemCode: string;
  productName: string;
  description?: string;
  unit?: string;
  standardPrice: number;
  category?: string;
  drawingNumber?: string;
  revisionNumber?: string;
  isActive: boolean;
  stock?: Stock;
}

export interface Stock {
  id: string;
  productId: string;
  availableStock: number;
  reservedStock: number;
  minimumStock: number;
  location?: string;
  lastUpdated: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  workingHours?: number;
  status: string;
}

export interface Leave {
  id: string;
  userId: string;
  user?: { id: string; name: string; department?: string };
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason?: string;
  status: ApprovalStatus;
  adminNote?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  NEW_LEAD: 'New Lead',
  FOLLOW_UP_PENDING: 'Follow-Up Pending',
  TRIAL_PLANNED: 'Trial Planned',
  TRIAL_COMPLETED: 'Trial Completed',
  QUOTATION_SUBMITTED: 'Quotation Submitted',
  WAITING_APPROVAL: 'Waiting for Approval',
  NEGOTIATION: 'Negotiation',
  PURCHASE_ORDER: 'PO Received',
  LOST: 'Lost Opportunity',
  CLOSED: 'Closed',
};

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  VISIT: 'Site Visit',
  CALL: 'Phone Call',
  ONLINE: 'Online Meeting',
  TRIAL_SUPPORT: 'Trial Support',
  QUOTATION_DISCUSSION: 'Quotation Discussion',
  TECHNICAL_DISCUSSION: 'Technical Discussion',
};

export const STATUS_COLORS: Record<MeetingStatus, string> = {
  NEW_LEAD: 'bg-blue-100 text-blue-800',
  FOLLOW_UP_PENDING: 'bg-yellow-100 text-yellow-800',
  TRIAL_PLANNED: 'bg-purple-100 text-purple-800',
  TRIAL_COMPLETED: 'bg-indigo-100 text-indigo-800',
  QUOTATION_SUBMITTED: 'bg-orange-100 text-orange-800',
  WAITING_APPROVAL: 'bg-amber-100 text-amber-800',
  NEGOTIATION: 'bg-pink-100 text-pink-800',
  PURCHASE_ORDER: 'bg-green-100 text-green-800',
  LOST: 'bg-red-100 text-red-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};
