import { supabase } from './supabase';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export interface RouteData {
  vehicleNumber: string;
  vehicleType: 'bus' | 'train';
  operator: string;
  fromLocation: string;
  toLocation: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: string[];
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

export interface RouteAIResult {
  success: boolean;
  data?: RouteData;
  error?: string;
}

function detectNumberType(input: string): {
  type: 'registration' | 'service' | 'route' | 'unknown';
  operator: string;
  state: string;
} {
  const clean = input.trim().toUpperCase().replace(/\s+/g, ' ');
  const regPattern = /^([A-Z]{2})\s?(\d{2})\s?([A-Z]{1,3})\s?(\d{1,4})$/;
  if (regPattern.test(clean.replace(/-/g, ' '))) {
    const stateCode = clean.slice(0, 2);
    const stateMap: Record<string, string> = {
      AP: 'APSRTC', KA: 'KSRTC', TN: 'TNSTC', MH: 'MSRTC',
      GJ: 'GSRTC', TS: 'TSRTC', KL: 'KSRTC Kerala', UP: 'UPSRTC',
      RJ: 'RSRTC', HR: 'Haryana Roadways', PB: 'PUNBUS', DL: 'DTC', WB: 'WBTC',
    };
    return { type: 'registration', operator: stateMap[stateCode] || 'State RTC', state: stateCode };
  }
  const servicePattern = /^(APSRTC|KSRTC|TSRTC|MSRTC|GSRTC|TNSTC|UPSRTC|RSRTC|DTC|WBTC)/;
  if (servicePattern.test(clean)) {
    const match = clean.match(servicePattern)!;
    return { type: 'service', operator: match[1], state: '' };
  }
  if (/^\d+[A-Z]?$/.test(clean) || /^[A-Z]\d+$/.test(clean)) {
    return { type: 'route', operator: 'Unknown', state: '' };
  }
  return { type: 'unknown', operator: 'Unknown', state: '' };
}

async function askGroq(prompt: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: 'You are an Indian public transport expert. You know all state RTC bus routes, train routes, and schedules across India. Always respond with valid JSON only. No markdown, no explanation, no backticks.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Groq error:', err);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('Groq fetch error:', err);
    return null;
  }
}

export async function fetchRouteWithAI(
  vehicleNumber: string,
  fromHint?: string,
  toHint?: string
): Promise<RouteAIResult> {
  try {
    const detected = detectNumberType(vehicleNumber);
    const clean = vehicleNumber.trim();

    const prompt = `You are an Indian transport data expert. Find route details for this vehicle: "${clean}"
${fromHint ? `The user says they are traveling FROM: "${fromHint}"` : ''}
${toHint ? `The user says they are traveling TO: "${toHint}"` : ''}

Detected type: ${detected.type}
Likely operator: ${detected.operator}

Instructions:
- For registration numbers like "AP 39 Z 0101": identify state (AP = Andhra Pradesh = APSRTC), guess the typical route for buses with this registration series
- For service numbers like "KSRTC-101": find the exact route
- If fromHint and toHint are provided, use them as fromLocation and toLocation
- Make reasonable estimates for timings based on typical journey distances
- Always return a valid route even if confidence is low

Respond with ONLY this JSON structure (no markdown, no backticks):
{
  "vehicleNumber": "${clean}",
  "vehicleType": "bus",
  "operator": "${detected.operator}",
  "fromLocation": "city name",
  "toLocation": "city name",
  "departureTime": "06:00 AM",
  "arrivalTime": "10:00 AM",
  "durationMinutes": 240,
  "stops": ["stop1", "stop2", "stop3"],
  "confidence": "high",
  "source": "knowledge base"
}`;

    const groqResponse = await askGroq(prompt);

    if (!groqResponse) {
      return { success: false, error: 'AI service unavailable. Please check your GROQ_API_KEY in .env file.' };
    }

    // Extract JSON
    const jsonMatch = groqResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'Could not parse route data from AI' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return { success: false, error: 'Invalid response from AI' };
    }

    if (parsed.error) return { success: false, error: parsed.error };
    if (!parsed.fromLocation || !parsed.toLocation) {
      return { success: false, error: 'AI could not determine route origin/destination' };
    }

    // Fill defaults
    if (!parsed.arrivalTime) parsed.arrivalTime = '11:59 PM';
    if (!parsed.departureTime) parsed.departureTime = '12:00 AM';
    if (!parsed.durationMinutes) parsed.durationMinutes = 60;
    if (!parsed.stops) parsed.stops = [];
    if (!parsed.operator) parsed.operator = detected.operator;
    if (!parsed.confidence) parsed.confidence = 'low';
    if (!parsed.vehicleType) parsed.vehicleType = 'bus';
    if (!parsed.source) parsed.source = 'AI knowledge base';

    return { success: true, data: parsed as RouteData };

  } catch (err) {
    console.error('Route AI error:', err);
    return { success: false, error: 'Failed to fetch route data. Please try again.' };
  }
}

export async function cacheRouteData(route: RouteData, supabaseClient: any): Promise<void> {
  try {
    await supabaseClient.from('vehicles').upsert({
      vehicle_number: route.vehicleNumber,
      vehicle_type: route.vehicleType,
      operator: route.operator,
      from_location: route.fromLocation,
      to_location: route.toLocation,
      departure_time: route.departureTime,
      arrival_time: route.arrivalTime,
      duration_minutes: route.durationMinutes,
      stops: route.stops,
      is_active: true,
      ai_sourced: true,
      confidence: route.confidence,
      source: route.source,
    }, { onConflict: 'vehicle_number' });
  } catch (err) {
    console.error('Failed to cache route:', err);
  }
}