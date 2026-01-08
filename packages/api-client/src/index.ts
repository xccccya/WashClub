// 包入口：只导出公开 API（generated + model）
// 生成物位于 ./generated（由 orval 生成，请勿手改 generated 内文件）
export * from './generated/washClubAPI';
export * from './generated/model';

// 非 generated 的扩展接口（手写封装，避免每次都必须重跑 orval）
export * from './memberPointsExtra';
export * from './washCardExtra';
export * from './groupBalanceExtra';


