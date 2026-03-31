import { NextRequest, NextResponse } from 'next/server'
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { maskPhone } from '@/lib/utils/mask'

const SYSTEM_PROMPT = `你是一位专业的呼叫中心质检专家。你的任务是分析客服通话录音内容，并根据质检标准进行评分和评价。

质检评分维度：
1. 问候语评分（0-10分）：评估坐席的开场白是否专业、友好
2. 专业能力评分（0-10分）：评估坐席对产品/服务的了解程度
3. 服务态度评分（0-10分）：评估坐席的服务态度、耐心程度
4. 信息准确性评分（0-10分）：评估坐席提供信息的准确性和完整性

评分标准：
- 优秀（9-10分）：表现卓越，超出预期
- 良好（8-8.9分）：表现良好，符合要求
- 合格（7-7.9分）：基本合格，有改进空间
- 不合格（<7分）：表现不佳，需要改进

请根据提供的通话信息，给出详细的质检分析结果。

输出格式要求（必须严格按照以下JSON格式输出）：
{
  "greetingScore": <分数>,
  "professionalScore": <分数>,
  "attitudeScore": <分数>,
  "accuracyScore": <分数>,
  "overallScore": <平均分>,
  "qualityResult": "<优秀/良好/合格/不合格>",
  "qualityComment": "<详细评语>",
  "improvementSuggestion": "<改进建议>",
  "analysis": "<详细分析过程>"
}`

export async function POST(request: NextRequest) {
  try {
    const { recordingInfo } = await request.json()
    
    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)
    
    // 初始化LLM客户端
    const config = new Config()
    const client = new LLMClient(config, customHeaders)
    
    // 构建用户消息
    const userMessage = `
请对以下客服通话进行质检分析：

录音信息：
- 录音UUID: ${recordingInfo.uuid}
- 坐席工号: ${recordingInfo.agent}
- 坐席姓名: ${recordingInfo.agentName}
- 被叫号码: ${maskPhone(recordingInfo.calledPhone)}
- 开始时间: ${recordingInfo.startTime}
- 通话时长: ${recordingInfo.answerDuration}秒
- 通话状态: ${recordingInfo.statusName}

${recordingInfo.transcript ? `通话转录内容：\n${recordingInfo.transcript}` : '（暂无通话转录内容，请根据通话基本信息进行分析）'}

请给出详细的质检分析结果。
`

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: userMessage }
    ]
    
    // 创建流式响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = client.stream(messages, {
            model: 'doubao-seed-1-6-251015',
            temperature: 0.7
          })
          
          let fullContent = ''
          
          for await (const chunk of llmStream) {
            if (chunk.content) {
              const text = chunk.content.toString()
              fullContent += text
              
              // 发送SSE格式数据
              const data = JSON.stringify({ content: text, done: false })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }
          
          // 尝试解析JSON结果
          try {
            // 提取JSON部分
            const jsonMatch = fullContent.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0])
              const finalData = JSON.stringify({ 
                content: '', 
                done: true,
                result: result
              })
              controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
            } else {
              // 如果没有找到JSON，发送完成标记
              const finalData = JSON.stringify({ 
                content: '', 
                done: true,
                rawContent: fullContent
              })
              controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
            }
          } catch (e) {
            // 解析失败，发送原始内容
            const finalData = JSON.stringify({ 
              content: '', 
              done: true,
              rawContent: fullContent
            })
            controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
          }
          
          controller.close()
        } catch (error: any) {
          const errorData = JSON.stringify({ error: error.message, done: true })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'AI质检分析失败' },
      { status: 500 }
    )
  }
}
