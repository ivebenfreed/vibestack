import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { db } from "~/lib/mock-db";

export async function GET(event: APIEvent) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const url = new URL(event.request.url);
  const search = url.searchParams.get('search') || undefined;
  const type = url.searchParams.get('type') || undefined;
  
  const entities = db.getEntities({ search, type });
  const stats = db.getStats();
  
  return json({
    success: true,
    data: entities,
    total: entities.length,
    meta: stats
  });
}

export async function POST(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    const { name, type = 'table', description = '', fields = [] } = body;

    if (!name) {
      return json(
        { error: "Entity name is required" },
        { status: 400 }
      );
    }

    // Check if entity already exists
    if (db.entityExists(name)) {
      return json(
        { error: "Entity with this name already exists" },
        { status: 409 }
      );
    }

    const newEntity = db.createEntity({
      name,
      type,
      description,
      fields
    });

    return json({
      success: true,
      message: "Entity created successfully",
      data: newEntity
    });

  } catch (error) {
    return json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function PUT(event: APIEvent) {
  try {
    const url = new URL(event.request.url);
    const id = parseInt(url.searchParams.get('id') || '0');
    
    if (!id) {
      return json(
        { error: "Entity ID is required" },
        { status: 400 }
      );
    }

    const body = await new Response(event.request.body).json();
    const { name, type, description, fields } = body;

    const updatedEntity = db.updateEntity(id, {
      ...(name && { name }),
      ...(type && { type }),
      ...(description !== undefined && { description }),
      ...(fields && { fields })
    });

    if (!updatedEntity) {
      return json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    return json({
      success: true,
      message: "Entity updated successfully",
      data: updatedEntity
    });

  } catch (error) {
    return json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function DELETE(event: APIEvent) {
  try {
    const url = new URL(event.request.url);
    const id = parseInt(url.searchParams.get('id') || '0');
    
    if (!id) {
      return json(
        { error: "Entity ID is required" },
        { status: 400 }
      );
    }

    const deletedEntity = db.deleteEntity(id);

    if (!deletedEntity) {
      return json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    return json({
      success: true,
      message: "Entity deleted successfully",
      data: deletedEntity
    });

  } catch (error) {
    return json(
      { error: "Failed to delete entity" },
      { status: 500 }
    );
  }
}