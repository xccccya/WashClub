import type { OrderType, Prisma } from '@prisma/client';

// NOTE: Prisma 的 Json 字段在类型层面不接受 `null`，需要用 Prisma.JsonNull/DbNull。
// 这里快照字段用 `undefined` 表示缺失，避免在 controller/service 里到处处理 JsonNull。
export type ProxyAdminSnapshot = {
  id: number;
  name?: string;
  phone?: string;
};

export type CreateOrderBody = {
  type: OrderType;
  memberId?: number | null;
  vehicleId?: number | null;
  groupId?: number | null;
  shippingAddressId?: number | null;
  noExpress?: boolean | null;
  cashierDiscountAmount?: Prisma.Decimal | number | null;
  items: Array<{
    productId?: number | null;
    skuId?: number | null;
    name: string;
    imageUrl?: string | null;
    specsText?: string | null;
    barcode?: string | null;
    price: Prisma.Decimal | number;
    discount?: Prisma.Decimal | number;
    quantity: number;
  }>;
  userRemark?: string | null;
  remark?: string | null;
  shippingFee?: Prisma.Decimal | number;
  usedPoints?: number;
  pointsAmount?: Prisma.Decimal | number;
  couponInfo?: Prisma.InputJsonValue | null;
  memberCouponId?: number | null;
  memberCouponIds?: number[] | null;
  disableMemberDiscount?: boolean | null;
  payAfterService?: boolean | null;
};

export type CreateFkBody = {
  amount: number;
  remark?: string | null;
  memberId?: number | null;
};

export type JwtTokenType = 'admin' | 'member';

export interface AuthJwtPayload {
  sub?: string | number;
  type?: JwtTokenType;
  exp?: number;
  [k: string]: unknown;
}


