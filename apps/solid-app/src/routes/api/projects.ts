import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";

// Mock data
const projects = [
  { id: 1, name: 'Website Redesign', status: 'In Progress', progress: 65, due: '2024-02-15' },
  { id: 2, name: 'Mobile App Development', status: 'Planning', progress: 20, due: '2024-03-01' },
  { id: 3, name: 'Marketing Campaign', status: 'In Progress', progress: 80, due: '2024-01-31' },
  { id: 4, name: 'Data Migration', status: 'Testing', progress: 90, due: '2024-02-10' },
];

export async function GET(event: APIEvent) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return json({
    success: true,
    data: projects,
    total: projects.length
  });
}

export async function POST(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    const { name, status = 'Planning', due } = body;

    if (!name) {
      return json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    const newProject = {
      id: Math.max(...projects.map(p => p.id)) + 1,
      name,
      status,
      progress: 0,
      due: due || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    projects.push(newProject);

    return json({
      success: true,
      message: "Project created successfully",
      data: newProject
    });

  } catch (error) {
    return json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}