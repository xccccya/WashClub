import { z } from 'zod';

export const VehicleSchema = z.object({
	plateNumber: z.string().min(5),
	brand: z.string().optional(),
	color: z.string().optional(),
});

export const MemberSchema = z.object({
	id: z.number().int().nonnegative().optional(),
	name: z.string().min(1),
	phone: z.string().min(6),
	points: z.number().int().nonnegative().default(0),
	balance: z.number().nonnegative().default(0),
	vehicles: z.array(VehicleSchema).default([]),
});

export type Vehicle = z.infer<typeof VehicleSchema>;
export type Member = z.infer<typeof MemberSchema>;


