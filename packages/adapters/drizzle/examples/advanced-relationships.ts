// TODO: Now we are type safe this can be updated to use the types from the schema
// TODO: remove the any types
import { defineTableRow } from '@better-tables/core';
import { drizzleAdapter } from '../src/factory';
import type { RelationshipMap } from '../src/types';
import Database from 'better-sqlite3';
import { relations, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';


// Complex schema with many-to-many relationships
const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  companyId: integer('company_id').references(() => companies.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

const companies = sqliteTable('companies', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry'),
  size: text('size'), // 'startup', 'small', 'medium', 'large'
  founded: integer('founded', { mode: 'timestamp' }),
});

const departments = sqliteTable('departments', {
  id: integer('id').primaryKey(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id),
  name: text('name').notNull(),
  budget: integer('budget'),
  managerId: integer('manager_id').references(() => users.id),
});

const projects = sqliteTable('projects', {
  id: integer('id').primaryKey(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id),
  departmentId: integer('department_id').references(() => departments.id),
  name: text('name').notNull(),
  status: text('status'), // 'planning', 'active', 'completed', 'cancelled'
  budget: integer('budget'),
  startDate: integer('start_date', { mode: 'timestamp' }),
  endDate: integer('end_date', { mode: 'timestamp' }),
});

const roles = sqliteTable('roles', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  level: text('level'), // 'junior', 'mid', 'senior', 'lead', 'executive'
});

// Many-to-many junction tables
const userRoles = sqliteTable('user_roles', {
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  roleId: integer('role_id')
    .notNull()
    .references(() => roles.id),
  assignedAt: integer('assigned_at', { mode: 'timestamp' }).notNull(),
});

const userProjects = sqliteTable('user_projects', {
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id),
  role: text('role'), // 'lead', 'developer', 'designer', 'tester'
  hoursAllocated: integer('hours_allocated'),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull(),
});

const skills = sqliteTable('skills', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category'), // 'technical', 'soft', 'domain'
  proficiency: text('proficiency'), // 'beginner', 'intermediate', 'advanced', 'expert'
});

const userSkills = sqliteTable('user_skills', {
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  skillId: integer('skill_id')
    .notNull()
    .references(() => skills.id),
  proficiency: text('proficiency'),
  yearsExperience: integer('years_experience'),
  certified: integer('certified', { mode: 'boolean' }).default(false),
});

// Relations
const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  managedDepartments: many(departments),
  userRoles: many(userRoles),
  userProjects: many(userProjects),
  userSkills: many(userSkills),
}));

const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  departments: many(departments),
  projects: many(projects),
}));

const departmentsRelations = relations(departments, ({ one, many }) => ({
  company: one(companies, {
    fields: [departments.companyId],
    references: [companies.id],
  }),
  manager: one(users, {
    fields: [departments.managerId],
    references: [users.id],
  }),
  projects: many(projects),
}));

const projectsRelations = relations(projects, ({ one, many }) => ({
  company: one(companies, {
    fields: [projects.companyId],
    references: [companies.id],
  }),
  department: one(departments, {
    fields: [projects.departmentId],
    references: [departments.id],
  }),
  userProjects: many(userProjects),
}));

const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

const skillsRelations = relations(skills, ({ many }) => ({
  userSkills: many(userSkills),
}));

const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

const userProjectsRelations = relations(userProjects, ({ one }) => ({
  user: one(users, {
    fields: [userProjects.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [userProjects.projectId],
    references: [projects.id],
  }),
}));

const userSkillsRelations = relations(userSkills, ({ one }) => ({
  user: one(users, {
    fields: [userSkills.userId],
    references: [users.id],
  }),
  skill: one(skills, {
    fields: [userSkills.skillId],
    references: [skills.id],
  }),
}));

const schema = {
  users,
  companies,
  departments,
  projects,
  roles,
  skills,
  userRoles,
  userProjects,
  userSkills,
} as const;

const relationsSchema = {
  users: usersRelations,
  companies: companiesRelations,
  departments: departmentsRelations,
  projects: projectsRelations,
  roles: rolesRelations,
  skills: skillsRelations,
  userRoles: userRolesRelations,
  userProjects: userProjectsRelations,
  userSkills: userSkillsRelations,
} as const;

// Define proper types for the complex data
type User = typeof users.$inferSelect;
type Company = typeof companies.$inferSelect;
type Department = typeof departments.$inferSelect;
type Project = typeof projects.$inferSelect;
type Role = typeof roles.$inferSelect;
type Skill = typeof skills.$inferSelect;
type UserRole = typeof userRoles.$inferSelect;
type UserProject = typeof userProjects.$inferSelect;
type UserSkill = typeof userSkills.$inferSelect;

type UserWithRelations = User & {
  company?: Company | null;
  managedDepartments?: Department[];
  userRoles?: (UserRole & { role?: Role })[];
  userProjects?: (UserProject & { project?: Project })[];
  userSkills?: (UserSkill & { skill?: Skill })[];
};

// Type for data returned by the adapter (includes computed columns)
type UserWithComputed = UserWithRelations & {
  total_hours?: number;
  avg_experience?: number;
  certified_skills?: number;
  skills_count?: number;
  projects_count?: number;
  roles_count?: number;
  is_manager?: boolean;
  is_senior?: boolean;
  has_active_projects?: boolean;
  skill_summary?: string;
  role_summary?: string;
  project_summary?: string;
};

// Custom relationship mappings for many-to-many
const customRelationships: RelationshipMap = {
  // User -> Roles (through userRoles)
  'roles.name': {
    from: 'users',
    to: 'userRoles',
    foreignKey: 'userId',
    localKey: 'id',
    cardinality: 'many',
    joinType: 'left',
  },
  'role.name': {
    from: 'userRoles',
    to: 'roles',
    foreignKey: 'roleId',
    localKey: 'id',
    cardinality: 'one',
    joinType: 'left',
  },

  // User -> Projects (through userProjects)
  'userProjects.project.name': {
    from: 'users',
    to: 'userProjects',
    foreignKey: 'userId',
    localKey: 'id',
    cardinality: 'many',
    joinType: 'left',
  },
  'project.name': {
    from: 'userProjects',
    to: 'projects',
    foreignKey: 'projectId',
    localKey: 'id',
    cardinality: 'one',
    joinType: 'left',
  },

  // User -> Skills (through userSkills)
  'userSkills.skill.name': {
    from: 'users',
    to: 'userSkills',
    foreignKey: 'userId',
    localKey: 'id',
    cardinality: 'many',
    joinType: 'left',
  },
  'skill.name': {
    from: 'userSkills',
    to: 'skills',
    foreignKey: 'skillId',
    localKey: 'id',
    cardinality: 'one',
    joinType: 'left',
  },
};

function buildUsersTable(_db: ReturnType<typeof drizzle>) {
  return defineTableRow<UserWithRelations>()('users', (t) => ({
    columns: [
      t.text('name').displayName('Name'),
      t.text('email').displayName('Email'),
      t.date('createdAt').displayName('Joined'),
      t.text('company.name').displayName('Company'),
      t.text('company.industry').displayName('Industry'),
      t.text('company.size').displayName('Company Size'),
      t.text('managedDepartments.name').displayName('Manages Department'),
      t.number('managedDepartments.budget').displayName('Dept Budget'),
      t.computed('roles.name', (user) => user.userRoles?.[0]?.role?.name).displayName('Primary Role'),
      t.computed('roles.level', (user) => user.userRoles?.[0]?.role?.level).displayName('Role Level'),
      t.computed('roles_count', (user) => user.userRoles?.length || 0).displayName('Role Count'),
      t.text('userProjects.project.name').displayName('Current Project'),
      t.text('userProjects.role').displayName('Project Role'),
      t.number('userProjects.hoursAllocated').displayName('Hours Allocated'),
      t.computed('projects_count', (user) => user.userProjects?.length || 0).displayName('Project Count'),
      t.text('userSkills.skill.name').displayName('Top Skill'),
      t.text('userSkills.proficiency').displayName('Skill Level'),
      t.number('userSkills.yearsExperience').displayName('Experience Years'),
      t.computed('skills_count', (user) => user.userSkills?.length || 0).displayName('Skills Count'),
      t.computed('total_hours', (user) =>
        user.userProjects?.reduce(
          (sum: number, up: UserProject) => sum + (up.hoursAllocated || 0),
          0
        ) || 0).displayName('Total Hours'),
      t.computed('avg_experience', (user) => {
        const skills = user.userSkills || [];
        return skills.length > 0
          ? skills.reduce((sum: number, us: UserSkill) => sum + (us.yearsExperience || 0), 0) /
              skills.length
          : 0;
      }).displayName('Avg Experience'),
      t.computed('certified_skills', (user) =>
        user.userSkills?.filter((us: UserSkill) => us.certified).length || 0
      ).displayName('Certified Skills'),
      t.computed('is_manager', (user) => (user.managedDepartments?.length || 0) > 0).displayName(
        'Is Manager'
      ),
      t.computed('is_senior', (user) =>
        user.userRoles?.some(
          (ur: UserRole & { role?: Role }) =>
            ur.role?.level === 'senior' || ur.role?.level === 'lead'
        ) || false
      ).displayName('Is Senior'),
      t.computed('has_active_projects', (user) =>
        user.userProjects?.some(
          (up: UserProject & { project?: Project }) => up.project?.status === 'active'
        ) || false
      ).displayName('Has Active Projects'),
      t.computed('skill_summary', (user) => {
        const skills = user.userSkills || [];
        const topSkills =
          skills
            .sort(
              (a: UserSkill, b: UserSkill) => (b.yearsExperience || 0) - (a.yearsExperience || 0)
            )
            .slice(0, 3)
            .map((us) => `${us.skill?.name} (${us.proficiency})`)
            .join(', ') || 'No skills';
        return topSkills || 'No skills';
      }).displayName('Skills'),
      t.computed('role_summary', (user) => {
        const roles = user.userRoles || [];
        return (
          roles
            .map((ur: UserRole & { role?: Role }) => `${ur.role?.name} (${ur.role?.level})`)
            .join(', ') || 'No roles'
        );
      }).displayName('Roles'),
      t.computed('project_summary', (user) => {
        const projects = user.userProjects || [];
        const activeProjects = projects.filter(
          (up: UserProject & { project?: Project }) => up.project?.status === 'active'
        );
        return activeProjects.length > 0
          ? activeProjects
              .map((up: UserProject & { project?: Project }) => up.project?.name)
              .join(', ')
          : 'No active projects';
      }).displayName('Projects'),
    ],
  }));
}
let usersTable: ReturnType<typeof buildUsersTable> | undefined;
let columns: ReturnType<typeof buildUsersTable>['columns'];

async function setupComplexDatabase() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema: { ...schema, ...relationsSchema } });

  // Create all tables
  await db.run(sql`CREATE TABLE companies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT,
    size TEXT,
    founded INTEGER
  )`);

  await db.run(sql`CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company_id INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
  )`);

  await db.run(sql`CREATE TABLE departments (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    budget INTEGER,
    manager_id INTEGER,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (manager_id) REFERENCES users(id)
  )`);

  await db.run(sql`CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL,
    department_id INTEGER,
    name TEXT NOT NULL,
    status TEXT,
    budget INTEGER,
    start_date INTEGER,
    end_date INTEGER,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
  )`);

  await db.run(sql`CREATE TABLE roles (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    level TEXT
  )`);

  await db.run(sql`CREATE TABLE skills (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    proficiency TEXT
  )`);

  await db.run(sql`CREATE TABLE user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    assigned_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  )`);

  await db.run(sql`CREATE TABLE user_projects (
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    role TEXT,
    hours_allocated INTEGER,
    joined_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
  )`);

  await db.run(sql`CREATE TABLE user_skills (
    user_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    proficiency TEXT,
    years_experience INTEGER,
    certified INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (skill_id) REFERENCES skills(id)
  )`);

  // Insert sample data
  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;
  const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;

  // Companies
  await db.run(sql`INSERT INTO companies (id, name, industry, size, founded) VALUES 
    (1, 'TechCorp', 'Technology', 'large', ${oneYearAgo}),
    (2, 'StartupXYZ', 'Fintech', 'startup', ${sixMonthsAgo}),
    (3, 'DesignStudio', 'Design', 'small', ${threeMonthsAgo})`);

  // Users
  await db.run(sql`INSERT INTO users (id, name, email, company_id, created_at) VALUES 
    (1, 'Alice Johnson', 'alice@techcorp.com', 1, ${oneYearAgo}),
    (2, 'Bob Smith', 'bob@techcorp.com', 1, ${sixMonthsAgo}),
    (3, 'Carol Davis', 'carol@startupxyz.com', 2, ${threeMonthsAgo}),
    (4, 'David Wilson', 'david@designstudio.com', 3, ${threeMonthsAgo}),
    (5, 'Eve Brown', 'eve@techcorp.com', 1, ${sixMonthsAgo})`);

  // Departments
  await db.run(sql`INSERT INTO departments (id, company_id, name, budget, manager_id) VALUES 
    (1, 1, 'Engineering', 500000, 1),
    (2, 1, 'Product', 200000, 2),
    (3, 2, 'Development', 100000, 3),
    (4, 3, 'Creative', 150000, 4)`);

  // Projects
  await db.run(sql`INSERT INTO projects (id, company_id, department_id, name, status, budget, start_date, end_date) VALUES 
    (1, 1, 1, 'Mobile App Redesign', 'active', 100000, ${sixMonthsAgo}, ${now + 90 * 24 * 60 * 60 * 1000}),
    (2, 1, 2, 'User Research Initiative', 'planning', 50000, ${now}, ${now + 180 * 24 * 60 * 60 * 1000}),
    (3, 2, 3, 'Payment System', 'active', 200000, ${threeMonthsAgo}, ${now + 60 * 24 * 60 * 60 * 1000}),
    (4, 3, 4, 'Brand Identity', 'completed', 75000, ${sixMonthsAgo}, ${now})`);

  // Roles
  await db.run(sql`INSERT INTO roles (id, name, description, level) VALUES 
    (1, 'Software Engineer', 'Develops software applications', 'senior'),
    (2, 'Product Manager', 'Manages product development', 'mid'),
    (3, 'UX Designer', 'Designs user experiences', 'senior'),
    (4, 'DevOps Engineer', 'Manages infrastructure', 'lead'),
    (5, 'Data Scientist', 'Analyzes data and builds models', 'senior')`);

  // Skills
  await db.run(sql`INSERT INTO skills (id, name, category, proficiency) VALUES 
    (1, 'React', 'technical', 'advanced'),
    (2, 'TypeScript', 'technical', 'expert'),
    (3, 'Node.js', 'technical', 'advanced'),
    (4, 'Leadership', 'soft', 'expert'),
    (5, 'Communication', 'soft', 'advanced'),
    (6, 'Figma', 'technical', 'expert'),
    (7, 'Python', 'technical', 'advanced'),
    (8, 'Machine Learning', 'domain', 'expert')`);

  // User Roles
  await db.run(sql`INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES 
    (1, 1, ${oneYearAgo}),
    (1, 4, ${sixMonthsAgo}),
    (2, 2, ${sixMonthsAgo}),
    (3, 1, ${threeMonthsAgo}),
    (4, 3, ${threeMonthsAgo}),
    (5, 5, ${sixMonthsAgo})`);

  // User Projects
  await db.run(sql`INSERT INTO user_projects (user_id, project_id, role, hours_allocated, joined_at) VALUES 
    (1, 1, 'lead', 40, ${sixMonthsAgo}),
    (2, 1, 'developer', 30, ${sixMonthsAgo}),
    (2, 2, 'lead', 20, ${now}),
    (3, 3, 'developer', 35, ${threeMonthsAgo}),
    (4, 4, 'designer', 25, ${sixMonthsAgo}),
    (5, 1, 'developer', 25, ${sixMonthsAgo})`);

  // User Skills
  await db.run(sql`INSERT INTO user_skills (user_id, skill_id, proficiency, years_experience, certified) VALUES 
    (1, 1, 'expert', 5, 1),
    (1, 2, 'expert', 4, 1),
    (1, 4, 'expert', 3, 0),
    (2, 2, 'advanced', 3, 1),
    (2, 5, 'expert', 5, 0),
    (3, 1, 'advanced', 2, 0),
    (3, 3, 'advanced', 3, 1),
    (4, 6, 'expert', 4, 1),
    (4, 5, 'advanced', 3, 0),
    (5, 7, 'expert', 6, 1),
    (5, 8, 'expert', 4, 1)`);

  return { db, sqlite };
}

async function createAdvancedAdapter(): Promise<DrizzleAdapter<User>> {
  const { db, sqlite } = await setupComplexDatabase();

  usersTable = buildUsersTable(db);
  columns = usersTable.columns;
  const adapter = drizzleAdapter(db, { relationships: customRelationships, options: { defaultPrimaryTable: 'users', defaultMutationTable: 'users' } });

  return { adapter, sqlite };
}

async function runAdvancedExamples() {
  const { adapter, sqlite } = await createAdvancedAdapter();
  const seniorDevsResult = await adapter.fetchData({
    filters: [
      {
        columnId: 'is_senior',
        type: 'boolean',
        operator: 'isTrue',
        values: [],
      },
      {
        columnId: 'has_active_projects',
        type: 'boolean',
        operator: 'isTrue',
        values: [],
      },
    ],
    sorting: [{ columnId: 'total_hours', direction: 'desc' }],
  });
  seniorDevsResult.data.forEach((_user: UserWithComputed) => {});
  const companyResult = await adapter.fetchData({
    columns: ['name', 'company.name', 'company.industry', 'company.size'],
    sorting: [{ columnId: 'company.name', direction: 'asc' }],
  });
  companyResult.data.forEach((_user: UserWithComputed) => {});
  const certifiedResult = await adapter.fetchData({
    filters: [
      {
        columnId: 'certified_skills',
        type: 'number',
        operator: 'greaterThan',
        values: [0],
      },
    ],
    sorting: [{ columnId: 'certified_skills', direction: 'desc' }],
  });
  certifiedResult.data.forEach((_user: UserWithComputed) => {});
  const workloadResult = await adapter.fetchData({
    columns: ['name', 'projects_count', 'total_hours', 'userProjects.role'],
    filters: [
      {
        columnId: 'projects_count',
        type: 'number',
        operator: 'greaterThan',
        values: [0],
      },
    ],
    sorting: [{ columnId: 'total_hours', direction: 'desc' }],
  });
  workloadResult.data.forEach((_user: UserWithComputed) => {});
  const roleSkillResult = await adapter.fetchData({
    columns: ['name', 'roles.name', 'roles.level', 'skill_summary'],
    filters: [
      {
        columnId: 'roles_count',
        type: 'number',
        operator: 'greaterThan',
        values: [0],
      },
    ],
  });
  roleSkillResult.data.forEach((_user: UserWithComputed) => {});
  const managerResult = await adapter.fetchData({
    filters: [
      {
        columnId: 'is_manager',
        type: 'boolean',
        operator: 'isTrue',
        values: [],
      },
    ],
    columns: ['name', 'managedDepartments.name', 'managedDepartments.budget'],
  });
  managerResult.data.forEach((_user: UserWithComputed) => {});
  const companyMetrics = await adapter.fetchData({
    columns: ['company.name', 'company.industry', 'company.size'],
    sorting: [{ columnId: 'company.name', direction: 'asc' }],
  });

  // Group by company for analysis
  const companyStats = new Map();
  companyMetrics.data.forEach((user: UserWithComputed) => {
    const companyName = user.company?.name || 'No Company';
    if (!companyStats.has(companyName)) {
      companyStats.set(companyName, {
        name: companyName,
        industry: user.company?.industry,
        size: user.company?.size,
        userCount: 0,
        totalSkills: 0,
        totalProjects: 0,
      });
    }
    const stats = companyStats.get(companyName);
    stats.userCount++;
    stats.totalSkills += user.skills_count || 0;
    stats.totalProjects += user.projects_count || 0;
  });
  companyStats.forEach((_stats) => {});
  await adapter.fetchData({
    columns: ['name', 'company.name', 'roles.name', 'skill_summary', 'project_summary'],
    sorting: [{ columnId: 'name', direction: 'asc' }],
  });
  await adapter.exportData({
    format: 'json',
    columns: [
      'name',
      'email',
      'company.name',
      'company.industry',
      'roles.name',
      'roles.level',
      'skill_summary',
      'projects_count',
      'total_hours',
      'certified_skills',
    ],
  });

  // Cleanup
  sqlite.close();
}

// Run examples
if (require.main === module) {
  runAdvancedExamples().catch(console.error);
}

export { createAdvancedAdapter, columns, schema, relationsSchema, customRelationships };
