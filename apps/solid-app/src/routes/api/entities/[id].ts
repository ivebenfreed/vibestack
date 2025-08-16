import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { db } from "~/lib/mock-db";

export async function GET(event: APIEvent) {
  const id = parseInt(event.params.id);
  
  if (!id || isNaN(id)) {
    return json(
      { error: "Invalid entity ID" },
      { status: 400 }
    );
  }
  
  const entity = db.getEntity(id);
  
  if (!entity) {
    return json(
      { error: "Entity not found" },
      { status: 404 }
    );
  }
  
  return json({
    success: true,
    data: entity
  });
}

export async function PUT(event: APIEvent) {
  try {
    const id = parseInt(event.params.id);
    
    if (!id || isNaN(id)) {
      return json(
        { error: "Invalid entity ID" },
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
  const id = parseInt(event.params.id);
  
  if (!id || isNaN(id)) {
    return json(
      { error: "Invalid entity ID" },
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
}