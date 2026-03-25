import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function searchWeb(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DestinyApp/1.0)' }
    })
    const data = await response.json()
    const results: string[] = []
    if (data.Abstract) results.push(data.Abstract)
    if (data.RelatedTopics?.length) {
      data.RelatedTopics.slice(0, 5).forEach((topic: any) => {
        if (topic.Text) results.push(topic.Text)
      })
    }
    return results.join('\n') || 'No results found'
  } catch {
    return 'Search failed'
  }
}

async function extractRouteWithGroq(
  vehicleNumber: string, searchResults: string,
  numberType: string, operator: string,
  fromHint?: string, toHint?: string
): Promise<string | null> {
  const groqApiKey = Deno.env.get('GROQ_API_KEY')!
  const prompt = `You are an Indian transport data expert. Extract bus route information from these search results.

Vehicle number: "${vehicleNumber}"
Number type: ${numberType}
Likely operator: ${operator}
${fromHint ? `User says from: ${fromHint}` : ''}
${toHint ? `User says to: ${toHint}` : ''}

Search results:
${searchResults}

Respond with ONLY valid JSON, no markdown:
{
  "vehicleNumber": "${vehicleNumber}",
  "vehicleType": "bus",
  "operator": "operator name",
  "fromLocation": "origin city",
  "toLocation": "destination city",
  "departureTime": "HH:MM AM/PM",
  "arrivalTime": "HH:MM AM/PM",
  "durationMinutes": 120,
  "stops": ["stop1", "stop2"],
  "confidence": "high or medium or low",
  "source": "source name"
}`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'You are an Indian transport expert. Always respond with valid JSON only. No markdown, no explanation.' },
        { role: 'user', content: prompt },
      ],
    }),
  })

  const data = await response.json()
  return data.choices?.[0]?.message?.content || null
}

serve(async (req) => {
  // ✅ Handle preflight FIRST — must return 200
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const { vehicleNumber, fromHint, toHint, searchQueries, operator, numberType } = await req.json()

    const searchResults: string[] = []
    for (const query of (searchQueries || []).slice(0, 3)) {
      const result = await searchWeb(query)
      if (result && result !== 'No results found' && result !== 'Search failed') {
        searchResults.push(`Query: "${query}"\nResults: ${result}`)
      }
    }

    if (fromHint && toHint) {
      const hintResult = await searchWeb(`${operator} bus ${fromHint} to ${toHint} route schedule`)
      if (hintResult && hintResult !== 'No results found') {
        searchResults.push(hintResult)
      }
    }

    const combined = searchResults.length > 0
      ? searchResults.join('\n\n---\n\n')
      : `No search results found for ${vehicleNumber}. Operator: ${operator}`

    const groqResponse = await extractRouteWithGroq(vehicleNumber, combined, numberType, operator, fromHint, toHint)

    if (!groqResponse) {
      return new Response(
        JSON.stringify({ error: 'AI could not process route data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const jsonMatch = groqResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: 'Could not parse route data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const route = JSON.parse(jsonMatch[0])
    return new Response(
      JSON.stringify(route.error ? { error: route.error } : { route }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})