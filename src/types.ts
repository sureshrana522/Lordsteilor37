// src/types.ts

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MEASUREMENT = 'MEASUREMENT',
  CUTTING = 'CUTTING',
  SHIRT_MAKER = 'SHIRT_MAKER',
  PANT_MAKER = 'PANT_MAKER',
  COAT_MAKER = 'COAT_MAKER',
  FINISHING = 'FINISHING',
  PRESS = 'PRESS',
  DELIVERY = 'DELIVERY'
}

export type SidebarItem = {
  id: string;
  label: string;
  icon?: any;
  path: string;
};

export enum OrderStage {
  PENDING = "Pending",
  CUTTING = "Cutting",
  STITCHING = "Stitching",
  FINISHING = "Finishing",
  COMPLETED = "Completed",
  DELIVERED = "Delivered"
}
