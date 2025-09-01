// AI Service with OpenRouter API integration
import { AIPrompt, Itinerary, Destination, TravoBotPrompt } from '../types';
import { destinations } from '../data/destinations';
import { v4 as uuidv4 } from 'uuid';

// Simulate AI response delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// OpenRouter API configuration
const OPENROUTER_API_KEY = "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";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export const generateItinerary = async (prompt: AIPrompt, userId: string): Promise<Itinerary> => {
  try {
    // Step 1: Generate a detailed travel plan using OpenRouter AI
    const detailedPlan = await generateDetailedTravelPlan(prompt);
    
    // Step 2: Extract information from the AI response and create a structured itinerary
    const selectedDestinations = prompt.destinationIds.map(id => 
      destinations.find(dest => dest.id === id)
    ).filter(Boolean) as Destination[];
    
    // Calculate date range
    const startDate = new Date(prompt.startDate);
    const endDate = new Date(prompt.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Distribute days among destinations
    const daysPerDestination = Math.floor(totalDays / selectedDestinations.length);
    const remainingDays = totalDays % selectedDestinations.length;
    
    // Create itinerary destinations with activities
    const itineraryDestinations = selectedDestinations.map((dest, index) => {
      const destId = dest?.id || '';
      const extraDay = index < remainingDays ? 1 : 0;
      const days = daysPerDestination + extraDay;
      
      // Generate activities based on highlights and AI recommendations
      const highlights = destinations.find(d => d.id === destId)?.highlights || [];
      
      // Combine default activities with AI-suggested ones
      const defaultActivities = [
        ...highlights,
        "Explore local cuisine",
        "Visit local markets",
        prompt.travelStyle === 'active' ? "Adventure activities" : "Relaxation time",
        prompt.interests.includes('culture') ? "Cultural experience" : "Scenic photography"
      ];
      
      // Extract AI-suggested activities if available
      const aiActivities = detailedPlan?.activities?.[destId] || [];
      
      // Combine and ensure we have enough activities
      const activities = [...new Set([...aiActivities, ...defaultActivities])].slice(0, days + 3);
      
      return {
        destinationId: destId,
        days,
        activities
      };
    });
    
    // Generate a title based on the destinations or use AI-generated title
    let title = detailedPlan?.title || "";
    if (!title) {
      const regionNames = [...new Set(selectedDestinations.map(dest => dest?.region || ''))];
      const stateNames = [...new Set(selectedDestinations.map(dest => dest?.state || ''))];
      
      if (regionNames.length === 1) {
        title = `${regionNames[0]} Adventure`;
      } else if (stateNames.length === 1) {
        title = `Exploring ${stateNames[0]}`;
      } else {
        title = `Indian Discovery Tour`;
      }
      
      if (prompt.travelStyle === 'relaxed') {
        title = `Relaxing ${title}`;
      } else if (prompt.travelStyle === 'active') {
        title = `Active ${title}`;
      }
    }
    
    // Create the final itinerary
    return {
      id: uuidv4(),
      userId,
      title,
      startDate: prompt.startDate,
      endDate: prompt.endDate,
      destinations: itineraryDestinations,
      totalBudget: prompt.budget,
      createdAt: new Date().toISOString().split('T')[0],
      isAIGenerated: true
    };
  } catch (error) {
    console.error("Error generating itinerary:", error);
    
    // Fallback to the basic itinerary generation if AI fails
    return generateBasicItinerary(prompt, userId);
  }
};

// Generate detailed travel plan using OpenRouter AI
const generateDetailedTravelPlan = async (prompt: AIPrompt) => {
  try {
    // Create a system prompt for the AI
    const systemPrompt = `
      You are a smart AI travel planner named TravoBot that helps users generate a full trip itinerary based on their preferences and budget. Your job is to generate recommendations for activities, places to visit, and other details for a travel plan.
      
      Focus on providing activities for these destinations: ${prompt.destinationIds.join(', ')}
      
      The trip starts on ${prompt.startDate} and ends on ${prompt.endDate}.
      Total budget: ${prompt.budget} INR
      Interests: ${prompt.interests.join(', ')}
      Travel style: ${prompt.travelStyle}
      Accommodation preference: ${prompt.accommodation}
      
      Provide detailed activities that align with the user's interests and travel style.
    `;
    
    // User message to elicit specific response format
    const userMessage = `
      Please suggest activities, a title, and other recommendations for my trip to the following destinations: ${prompt.destinationIds.join(', ')}. 
      The trip is from ${prompt.startDate} to ${prompt.endDate} with a budget of ${prompt.budget} INR.
      My interests include ${prompt.interests.join(', ')} and I prefer a ${prompt.travelStyle} travel style with ${prompt.accommodation} accommodation.
      
      Format your response as JSON with the following structure:
      {
        "title": "Suggested title for the trip",
        "activities": {
          "destination1": ["Activity 1", "Activity 2"],
          "destination2": ["Activity 1", "Activity 2"]
        }
      }
    `;
    
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Travel India AI Planner'
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || "";
    
    // Extract JSON from the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Failed to parse AI response as JSON:", e);
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error calling OpenRouter API for travel plan:", error);
    return null;
  }
};

// Basic itinerary generation as fallback
const generateBasicItinerary = (prompt: AIPrompt, userId: string): Itinerary => {
  // Simulate processing time
  
  const selectedDestinations = prompt.destinationIds.map(id => 
    destinations.find(dest => dest.id === id)
  ).filter(Boolean) as Destination[];
  
  // Calculate date range
  const startDate = new Date(prompt.startDate);
  const endDate = new Date(prompt.endDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Distribute days among destinations
  const daysPerDestination = Math.floor(totalDays / selectedDestinations.length);
  const remainingDays = totalDays % selectedDestinations.length;
  
  // Create a basic itinerary structure
  const itineraryDestinations = selectedDestinations.map((dest, index) => {
    const destId = dest?.id || '';
    const extraDay = index < remainingDays ? 1 : 0;
    const days = daysPerDestination + extraDay;
    
    // Generate activities based on highlights
    const highlights = destinations.find(d => d.id === destId)?.highlights || [];
    const activities = [
      ...highlights,
      "Explore local cuisine",
      "Visit local markets",
      prompt.travelStyle === 'active' ? "Adventure activities" : "Relaxation time",
      prompt.interests.includes('culture') ? "Cultural experience" : "Scenic photography"
    ];
    
    return {
      destinationId: destId,
      days,
      activities: activities.slice(0, days + 3) // Ensure we have enough activities
    };
  });
  
  // Generate a title based on the destinations
  const regionNames = [...new Set(selectedDestinations.map(dest => dest?.region || ''))];
  const stateNames = [...new Set(selectedDestinations.map(dest => dest?.state || ''))];
  
  let title = "";
  if (regionNames.length === 1) {
    title = `${regionNames[0]} Adventure`;
  } else if (stateNames.length === 1) {
    title = `Exploring ${stateNames[0]}`;
  } else {
    title = `Indian Discovery Tour`;
  }
  
  if (prompt.travelStyle === 'relaxed') {
    title = `Relaxing ${title}`;
  } else if (prompt.travelStyle === 'active') {
    title = `Active ${title}`;
  }
  
  // Create the final itinerary
  return {
    id: uuidv4(),
    userId,
    title,
    startDate: prompt.startDate,
    endDate: prompt.endDate,
    destinations: itineraryDestinations,
    totalBudget: prompt.budget,
    createdAt: new Date().toISOString().split('T')[0],
    isAIGenerated: true
  };
};

export const getSmartSuggestions = async (destinationId: string, interests: string[] = []) => {
  // Simulate processing time
  await delay(800);
  
  const destination = destinations.find(d => d.id === destinationId);
  
  if (!destination) {
    return [];
  }
  
  // Get destinations from the same region
  const sameRegion = destinations
    .filter(d => d.region === destination.region && d.id !== destinationId)
    .slice(0, 3);
  
  // Get destinations from the same state
  const sameState = destinations
    .filter(d => d.state === destination.state && d.id !== destinationId)
    .slice(0, 2);
  
  // Combine and remove duplicates
  const suggestions = [...sameRegion, ...sameState]
    .filter((dest, index, self) => 
      index === self.findIndex((d) => d.id === dest.id)
    )
    .slice(0, 4);
  
  return suggestions;
};

// ChatBot response generation using OpenRouter API
export const sendMessage = async (message: string): Promise<string> => {
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Travel India AI Chatbot'
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [
          {
            role: "system",
            content: "You are a friendly and knowledgeable travel assistant for an Indian travel platform. Provide helpful, accurate, and concise information about Indian destinations, travel tips, and recommendations. Keep responses under 150 words and focused on Indian travel. Don't mention that you're Claude or an AI assistant."
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', await response.text());
      return "I'm having trouble connecting to my knowledge base right now. Please try again in a moment.";
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "I couldn't generate a proper response. Please try again.";
  } catch (error) {
    console.error('Error calling OpenRouter API:', error);
    
    // Fallback to basic pattern matching responses
    const lowercaseMessage = message.toLowerCase();
    
    if (lowercaseMessage.includes("hello") || lowercaseMessage.includes("hi")) {
      return "Hello! How can I help with your travel plans today?";
    }
    
    if (lowercaseMessage.includes("recommend") || lowercaseMessage.includes("suggest")) {
      if (lowercaseMessage.includes("beach")) {
        return "For beach destinations in India, I'd recommend Goa for its vibrant atmosphere, Andaman & Nicobar Islands for pristine beaches, or Kerala for a more relaxed coastal experience.";
      }
      
      if (lowercaseMessage.includes("mountain") || lowercaseMessage.includes("hill")) {
        return "For mountain getaways, consider visiting Shimla, Manali, or Ooty. They offer beautiful landscapes, pleasant weather, and plenty of outdoor activities.";
      }
      
      return "Based on trends, I'd recommend exploring Kerala for its diverse experiences, Rajasthan for its rich culture, or Himachal Pradesh for natural beauty. Do you have any specific interests?";
    }
    
    // Default fallback response
    return "Thanks for your message. I can help with destination recommendations, itinerary planning, and travel tips for Indian destinations. Could you provide more details about what you're looking for?";
  }
};

// Function to generate a detailed travel plan in JSON format for the TravoBot UI
export const generateTravoBotPlan = async (prompt: TravoBotPrompt): Promise<any> => {
  try {
    const { startCity, destinations, numDays, totalBudget, interests, groupType, startDate } = prompt;
    
    const today = new Date();
    const endDate = new Date(today.setDate(today.getDate() + numDays - 1)).toISOString().split('T')[0];
    
    // Create a system prompt for TravoBot
    const travoBotSystemPrompt = `
      You are a smart AI travel planner named TravoBot that helps users generate a full trip itinerary based on their preferences and budget. Your job is to generate a well-structured, day-by-day travel plan in JSON format, which includes:

      1. A day-wise breakdown of the itinerary, including:
         - Date
         - City/Location
         - List of 2–4 famous spots (with short descriptions)
         - Estimated distance between places (approx km)
         - Recommended activities
         - Estimated time for each spot

      2. Include the current weather (temperature, condition) for each location per day using user-input date.

      3. For each day, allocate a daily budget breakdown:
         - Stay (INR ₹)
         - Travel (INR ₹)
         - Food (INR ₹)
         - Miscellaneous (INR ₹)

      4. At the end of the plan:
         - Show Total Budget
         - Show Chart breakdown of budget per day
         - Summarize trip (e.g., number of spots visited, kilometers covered)

      5. Use only known tourist places from India.

      6. Structure your entire response in a valid JSON format.
    `;
    
    const userPrompt = `
      Generate a detailed ${numDays}-day travel itinerary for a trip from ${startCity} to ${destinations.join(', ')} with a total budget of ₹${totalBudget}.
      
      Trip details:
      - Start date: ${startDate}
      - End date: ${endDate}
      - Interests: ${interests.join(', ')}
      - Group type: ${groupType}
      
      The response must be in the following JSON schema (and must be valid parseable JSON):
      
      {
        "summary": {
          "destination": "Main Destination",
          "start_date": "${startDate}",
          "end_date": "${endDate}",
          "total_budget": ${totalBudget},
          "estimated_kms": 450
        },
        "daily_plan": [
          {
            "day": 1,
            "date": "${startDate}",
            "location": "Location Name",
            "weather": {
              "temperature": "22°C",
              "condition": "Cloudy"
            },
            "spots": [
              {
                "name": "Spot Name",
                "description": "Brief description",
                "distance_km": 2
              }
            ],
            "activities": ["Activity 1", "Activity 2"],
            "budget": {
              "stay": 2000,
              "travel": 500,
              "food": 700,
              "misc": 300
            }
          }
        ],
        "budget_chart": {
          "labels": ["Day 1", "Day 2", "Day 3"],
          "datasets": {
            "stay": [2000, 1800, 1700],
            "travel": [500, 600, 400],
            "food": [700, 800, 650],
            "misc": [300, 200, 250]
          }
        }
      }
    `;
    
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Travel India TravoBot'
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [
          {
            role: "system",
            content: travoBotSystemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', await response.text());
      throw new Error('Failed to generate travel plan');
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || "";
    
    // Parse the JSON response
    try {
      // If it's already a JSON object, return it
      if (typeof aiResponse === 'object') {
        return aiResponse;
      }
      
      // Otherwise, try to parse it as JSON
      return JSON.parse(aiResponse);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", e);
      console.log("Raw response:", aiResponse);
      
      // Extract JSON from the response if it's wrapped in other text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Failed to extract and parse JSON:", e);
        }
      }
      
      throw new Error('Invalid response format from AI');
    }
  } catch (error) {
    console.error("Error generating TravoBot plan:", error);
    
    // Generate a simplified fallback response
    return generateFallbackTravelPlan(prompt);
  }
};

// Fallback function to generate a simplified travel plan
const generateFallbackTravelPlan = (prompt: TravoBotPrompt) => {
  const { startCity, destinations, numDays, totalBudget, interests, groupType, startDate } = prompt;
  
  const today = new Date();
  const dailyPlans = [];
  const labels = [];
  const stayData = [];
  const travelData = [];
  const foodData = [];
  const miscData = [];
  
  // Calculate budgets
  const dailyBudget = Math.floor(totalBudget / numDays);
  const stayBudget = Math.floor(dailyBudget * 0.4);
  const travelBudget = Math.floor(dailyBudget * 0.3);
  const foodBudget = Math.floor(dailyBudget * 0.2);
  const miscBudget = dailyBudget - stayBudget - travelBudget - foodBudget;
  
  // Generate daily plans
  for (let i = 0; i < numDays; i++) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() + i);
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Pick a destination
    const destinationIndex = Math.min(i, destinations.length - 1);
    const location = destinations[destinationIndex];
    
    // Generate random temperature between 22-32°C
    const temperature = Math.floor(Math.random() * 10 + 22);
    
    // Random weather conditions
    const conditions = ["Sunny", "Partly cloudy", "Cloudy", "Light rain", "Clear"];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    
    // Generate spots
    const spots = [
      {
        name: `${location} Main Attraction`,
        description: "A beautiful and popular tourist destination.",
        distance_km: Math.floor(Math.random() * 5 + 1)
      },
      {
        name: `${location} Museum`,
        description: "Historical artifacts and cultural exhibitions.",
        distance_km: Math.floor(Math.random() * 3 + 2)
      }
    ];
    
    // Generate activities based on interests
    const activityOptions = [
      "Sightseeing", "Photography", "Shopping", "Local cuisine", 
      "Cultural show", "Hiking", "Relaxation", "Temple visit"
    ];
    
    // Select 2-3 activities
    const numActivities = Math.floor(Math.random() * 2 + 2);
    const activities = [];
    for (let j = 0; j < numActivities; j++) {
      const randomIndex = Math.floor(Math.random() * activityOptions.length);
      activities.push(activityOptions[randomIndex]);
      activityOptions.splice(randomIndex, 1);
    }
    
    // Small variations in budget
    const stayVar = Math.floor(Math.random() * 200 - 100);
    const travelVar = Math.floor(Math.random() * 100 - 50);
    const foodVar = Math.floor(Math.random() * 100 - 50);
    
    const dayStay = stayBudget + stayVar;
    const dayTravel = travelBudget + travelVar;
    const dayFood = foodBudget + foodVar;
    const dayMisc = miscBudget;
    
    stayData.push(dayStay);
    travelData.push(dayTravel);
    foodData.push(dayFood);
    miscData.push(dayMisc);
    labels.push(`Day ${i+1}`);
    
    dailyPlans.push({
      day: i + 1,
      date: dateStr,
      location,
      weather: {
        temperature: `${temperature}°C`,
        condition
      },
      spots,
      activities,
      budget: {
        stay: dayStay,
        travel: dayTravel,
        food: dayFood,
        misc: dayMisc
      }
    });
  }
  
  // Calculate total estimated kilometers
  const estimatedKms = Math.floor(Math.random() * 200 + 300);
  
  // Use the provided start date or fallback to today
  const actualStartDate = startDate || today.toISOString().split('T')[0];
  const endDateObj = new Date(today);
  endDateObj.setDate(today.getDate() + numDays - 1);
  const actualEndDate = endDateObj.toISOString().split('T')[0];
  
  return {
    summary: {
      destination: destinations[0],
      start_date: actualStartDate,
      end_date: actualEndDate,
      total_budget: totalBudget,
      estimated_kms: estimatedKms,
      userName: prompt.userName
    },
    daily_plan: dailyPlans,
    budget_chart: {
      labels,
      datasets: {
        stay: stayData,
        travel: travelData,
        food: foodData,
        misc: miscData
      }
    }
  };
};
