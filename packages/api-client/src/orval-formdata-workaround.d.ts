/**
 * Workaround for a known multipart/form-data generation issue in the current
 * orval(fetch) output: `washClubAPI.ts` references an identifier named `formData`
 * for upload endpoints (e.g. `/file/upload`, `/assets/upload`) without declaring it.
 *
 * We do NOT rely on SDK for uploads (per project rule: uploads keep fetch/uni.uploadFile),
 * but the generated file must type-check to keep the monorepo builds green.
 *
 * Do not import from this file.
 */
declare const formData: any;


