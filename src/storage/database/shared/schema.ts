import { pgTable, serial, varchar, integer, timestamp, bigint, text, decimal, index, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// 系统用户表
export const qmsSysUser = pgTable("qms_sys_user", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 100 }).notNull(),
  realName: varchar("real_name", { length: 50 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 100 }),
  cityCode: varchar("city_code", { length: 20 }),
  cityName: varchar("city_name", { length: 50 }),
  roleId: bigint("role_id", { mode: "number" }).notNull(),
  status: integer("status").default(1).notNull(),
  lastLoginTime: timestamp("last_login_time", { withTimezone: true }),
  lastLoginIp: varchar("last_login_ip", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 50 }),
  updatedBy: varchar("updated_by", { length: 50 }),
  remark: text("remark"),
}, (table) => [
  index("idx_user_username").on(table.username),
  index("idx_user_city_code").on(table.cityCode),
  index("idx_user_role_id").on(table.roleId),
])

// 角色表
export const qmsSysRole = pgTable("qms_sys_role", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  roleName: varchar("role_name", { length: 50 }).notNull(),
  roleCode: varchar("role_code", { length: 50 }).notNull().unique(),
  roleLevel: integer("role_level").default(1).notNull(),
  description: varchar("description", { length: 200 }),
  status: integer("status").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  remark: text("remark"),
}, (table) => [
  index("idx_role_role_code").on(table.roleCode),
])

// 权限表
export const qmsSysPermission = pgTable("qms_sys_permission", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  permissionName: varchar("permission_name", { length: 50 }).notNull(),
  permissionCode: varchar("permission_code", { length: 100 }).notNull().unique(),
  permissionType: integer("permission_type"),
  parentId: bigint("parent_id", { mode: "number" }).default(0),
  path: varchar("path", { length: 200 }),
  icon: varchar("icon", { length: 50 }),
  sort: integer("sort").default(0),
  status: integer("status").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  remark: text("remark"),
}, (table) => [
  index("idx_permission_parent_id").on(table.parentId),
  index("idx_permission_permission_code").on(table.permissionCode),
])

// 角色权限关联表
export const qmsSysRolePermission = pgTable("qms_sys_role_permission", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  roleId: bigint("role_id", { mode: "number" }).notNull(),
  permissionId: bigint("permission_id", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uk_role_permission").on(table.roleId, table.permissionId),
  index("idx_role_permission_role_id").on(table.roleId),
  index("idx_role_permission_permission_id").on(table.permissionId),
])

// 录音清单表
export const qmsRecordingList = pgTable("qms_recording_list", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  uuid: varchar("uuid", { length: 100 }).notNull().unique(),
  companyId: integer("company_id"),
  projectId: integer("project_id"),
  taskId: integer("task_id"),
  batchId: integer("batch_id"),
  agent: varchar("agent", { length: 20 }),
  agentName: varchar("agent_name", { length: 50 }),
  callingPhone: varchar("calling_phone", { length: 20 }),
  calledPhone: varchar("called_phone", { length: 20 }),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  answerDuration: bigint("answer_duration", { mode: "number" }),
  playUrl: varchar("play_url", { length: 500 }),
  status: integer("status"),
  statusName: varchar("status_name", { length: 50 }),
  qualityStatus: integer("quality_status").default(0),
  remark: text("remark"),
  syncTime: timestamp("sync_time", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_recording_uuid").on(table.uuid),
  index("idx_recording_project_id").on(table.projectId),
  index("idx_recording_task_id").on(table.taskId),
  index("idx_recording_agent").on(table.agent),
  index("idx_recording_status").on(table.status),
  index("idx_recording_quality_status").on(table.qualityStatus),
  index("idx_recording_start_time").on(table.startTime),
  index("idx_recording_sync_time").on(table.syncTime),
])

// 质检评分表
export const qmsQualityScore = pgTable("qms_quality_score", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  recordingId: bigint("recording_id", { mode: "number" }).notNull(),
  recordingUuid: varchar("recording_uuid", { length: 100 }).notNull(),
  projectId: integer("project_id"),
  agent: varchar("agent", { length: 20 }),
  agentName: varchar("agent_name", { length: 50 }),
  qualityUserId: bigint("quality_user_id", { mode: "number" }),
  qualityUserName: varchar("quality_user_name", { length: 50 }),
  cityCode: varchar("city_code", { length: 20 }),
  cityName: varchar("city_name", { length: 50 }),
  greetingScore: decimal("greeting_score", { precision: 5, scale: 2 }).default("0"),
  professionalScore: decimal("professional_score", { precision: 5, scale: 2 }).default("0"),
  attitudeScore: decimal("attitude_score", { precision: 5, scale: 2 }).default("0"),
  accuracyScore: decimal("accuracy_score", { precision: 5, scale: 2 }).default("0"),
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }).default("0"),
  qualityResult: varchar("quality_result", { length: 20 }),
  qualityComment: text("quality_comment"),
  improvementSuggestion: text("improvement_suggestion"),
  qualityStatus: integer("quality_status").default(0),
  qualityTime: timestamp("quality_time", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uk_quality_recording_uuid").on(table.recordingUuid),
  index("idx_quality_recording_id").on(table.recordingId),
  index("idx_quality_user_id").on(table.qualityUserId),
  index("idx_quality_city_code").on(table.cityCode),
  index("idx_quality_status").on(table.qualityStatus),
  index("idx_quality_time").on(table.qualityTime),
  index("idx_overall_score").on(table.overallScore),
])

// 地市信息表
export const qmsCityInfo = pgTable("qms_city_info", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  cityCode: varchar("city_code", { length: 20 }).notNull().unique(),
  cityName: varchar("city_name", { length: 50 }).notNull(),
  provinceCode: varchar("province_code", { length: 20 }),
  provinceName: varchar("province_name", { length: 50 }),
  level: integer("level").default(2),
  sort: integer("sort").default(0),
  status: integer("status").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  remark: text("remark"),
}, (table) => [
  index("idx_city_city_code").on(table.cityCode),
  index("idx_city_province_code").on(table.provinceCode),
])

// 数据同步日志表
export const qmsSyncLog = pgTable("qms_sync_log", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  syncType: varchar("sync_type", { length: 20 }).notNull(),
  syncStartTime: timestamp("sync_start_time", { withTimezone: true }),
  syncEndTime: timestamp("sync_end_time", { withTimezone: true }),
  syncStatus: integer("sync_status"),
  syncCount: integer("sync_count").default(0),
  successCount: integer("success_count").default(0),
  failCount: integer("fail_count").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_sync_status").on(table.syncStatus),
  index("idx_sync_time").on(table.syncStartTime),
])

// 操作日志表
export const qmsOperationLog = pgTable("qms_operation_log", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  userId: bigint("user_id", { mode: "number" }),
  username: varchar("username", { length: 50 }),
  realName: varchar("real_name", { length: 50 }),
  operationType: varchar("operation_type", { length: 50 }),
  operationModule: varchar("operation_module", { length: 50 }),
  operationDesc: text("operation_desc"),
  requestMethod: varchar("request_method", { length: 10 }),
  requestUrl: varchar("request_url", { length: 500 }),
  requestParams: text("request_params"),
  responseResult: text("response_result"),
  ipAddress: varchar("ip_address", { length: 50 }),
  executeTime: bigint("execute_time", { mode: "number" }),
  operationTime: timestamp("operation_time", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_operation_user_id").on(table.userId),
  index("idx_operation_time").on(table.operationTime),
  index("idx_operation_type").on(table.operationType),
])

// 系统健康检查表 (Supabase内置)
export const healthCheck = pgTable("health_check", {
  id: serial("id").primaryKey(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
})

// 类型导出
export type User = typeof qmsSysUser.$inferSelect
export type Role = typeof qmsSysRole.$inferSelect
export type Permission = typeof qmsSysPermission.$inferSelect
export type Recording = typeof qmsRecordingList.$inferSelect
export type QualityScore = typeof qmsQualityScore.$inferSelect
export type CityInfo = typeof qmsCityInfo.$inferSelect
export type SyncLog = typeof qmsSyncLog.$inferSelect
export type OperationLog = typeof qmsOperationLog.$inferSelect
