import { relations } from "drizzle-orm/relations";
import { users, comments, tasks, projects, sessions, accounts, statusDefinitions, statusSets, tagSets, tags, projectMembers, taskDependencies, projectStatusSets, projectTagSets, taskTags } from "./schema";

export const commentsRelations = relations(comments, ({one, many}) => ({
	user: one(users, {
		fields: [comments.authorId],
		references: [users.id]
	}),
	comment: one(comments, {
		fields: [comments.parentId],
		references: [comments.id],
		relationName: "comments_parentId_comments_id"
	}),
	comments: many(comments, {
		relationName: "comments_parentId_comments_id"
	}),
	task: one(tasks, {
		fields: [comments.taskId],
		references: [tasks.id]
	}),
	project: one(projects, {
		fields: [comments.projectId],
		references: [projects.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	comments: many(comments),
	projects: many(projects),
	sessions: many(sessions),
	accounts: many(accounts),
	tasks: many(tasks),
	projectMembers: many(projectMembers),
}));

export const tasksRelations = relations(tasks, ({one, many}) => ({
	comments: many(comments),
	project: one(projects, {
		fields: [tasks.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [tasks.assigneeId],
		references: [users.id]
	}),
	statusDefinition: one(statusDefinitions, {
		fields: [tasks.statusId],
		references: [statusDefinitions.id]
	}),
	taskDependencies_dependentTaskId: many(taskDependencies, {
		relationName: "taskDependencies_dependentTaskId_tasks_id"
	}),
	taskDependencies_dependencyTaskId: many(taskDependencies, {
		relationName: "taskDependencies_dependencyTaskId_tasks_id"
	}),
	taskTags: many(taskTags),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	comments: many(comments),
	user: one(users, {
		fields: [projects.ownerId],
		references: [users.id]
	}),
	tasks: many(tasks),
	projectMembers: many(projectMembers),
	projectStatusSets: many(projectStatusSets),
	projectTagSets: many(projectTagSets),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const accountsRelations = relations(accounts, ({one}) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	}),
}));

export const statusDefinitionsRelations = relations(statusDefinitions, ({one, many}) => ({
	tasks: many(tasks),
	statusSet: one(statusSets, {
		fields: [statusDefinitions.statusSetId],
		references: [statusSets.id]
	}),
}));

export const statusSetsRelations = relations(statusSets, ({many}) => ({
	statusDefinitions: many(statusDefinitions),
	projectStatusSets: many(projectStatusSets),
}));

export const tagsRelations = relations(tags, ({one, many}) => ({
	tagSet: one(tagSets, {
		fields: [tags.tagSetId],
		references: [tagSets.id]
	}),
	tag: one(tags, {
		fields: [tags.parentId],
		references: [tags.id],
		relationName: "tags_parentId_tags_id"
	}),
	tags: many(tags, {
		relationName: "tags_parentId_tags_id"
	}),
	taskTags: many(taskTags),
}));

export const tagSetsRelations = relations(tagSets, ({many}) => ({
	tags: many(tags),
	projectTagSets: many(projectTagSets),
}));

export const projectMembersRelations = relations(projectMembers, ({one}) => ({
	project: one(projects, {
		fields: [projectMembers.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [projectMembers.userId],
		references: [users.id]
	}),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({one}) => ({
	task_dependentTaskId: one(tasks, {
		fields: [taskDependencies.dependentTaskId],
		references: [tasks.id],
		relationName: "taskDependencies_dependentTaskId_tasks_id"
	}),
	task_dependencyTaskId: one(tasks, {
		fields: [taskDependencies.dependencyTaskId],
		references: [tasks.id],
		relationName: "taskDependencies_dependencyTaskId_tasks_id"
	}),
}));

export const projectStatusSetsRelations = relations(projectStatusSets, ({one}) => ({
	project: one(projects, {
		fields: [projectStatusSets.projectId],
		references: [projects.id]
	}),
	statusSet: one(statusSets, {
		fields: [projectStatusSets.statusSetId],
		references: [statusSets.id]
	}),
}));

export const projectTagSetsRelations = relations(projectTagSets, ({one}) => ({
	project: one(projects, {
		fields: [projectTagSets.projectId],
		references: [projects.id]
	}),
	tagSet: one(tagSets, {
		fields: [projectTagSets.tagSetId],
		references: [tagSets.id]
	}),
}));

export const taskTagsRelations = relations(taskTags, ({one}) => ({
	task: one(tasks, {
		fields: [taskTags.taskId],
		references: [tasks.id]
	}),
	tag: one(tags, {
		fields: [taskTags.tagId],
		references: [tags.id]
	}),
}));