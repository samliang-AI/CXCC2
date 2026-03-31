/**
 * 电话号码脱敏
 * @param phone 原始电话号码
 * @returns 脱敏后的电话号码，格式：前3位****后4位
 * @example maskPhone('18088867328') => '180****7328'
 */
export function maskPhone(phone: string | undefined | null): string {
  if (!phone) return '-'
  
  // 去除空格
  const cleanPhone = phone.trim()
  
  // 如果长度小于7位，不进行脱敏
  if (cleanPhone.length < 7) {
    return cleanPhone
  }
  
  // 保留前3位和后4位，中间用****替代
  const prefix = cleanPhone.substring(0, 3)
  const suffix = cleanPhone.substring(cleanPhone.length - 4)
  
  return `${prefix}****${suffix}`
}
