// TODO: Now we are type safe this can be updated to use the types from the schema
// TODO: remove the any types
import { createColumnBuilder } from '@better-tables/core';
import type { RelationshipMap } from '@better-tables/drizzle';
import Database from 'better-sqlite3';
import { relations, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleAdapter } from '../src/drizzle-adapter';

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

// Create a typed column builder
const cb = createColumnBuilder<UserWithRelations>();

// Advanced column definitions
const columns = [
  // Basic user info
  cb
    .text()
    .id('name')
    .displayName('Name')
    .accessor((user) => user.name)
    .build(),
  cb
    .text()
    .id('email')
    .displayName('Email')
    .accessor((user) => user.email)
    .build(),
  cb
    .date()
    .id('createdAt')
    .displayName('Joined')
    .accessor((user) => user.createdAt)
    .build(),

  // Company information
  cb
    .text()
    .id('company.name')
    .displayName('Company')
    .nullableAccessor((user) => user.company?.name)
    .build(),
  cb
    .text()
    .id('company.industry')
    .displayName('Industry')
    .nullableAccessor((user) => user.company?.industry)
    .build(),
  cb
    .text()
    .id('company.size')
    .displayName('Company Size')
    .nullableAccessor((user) => user.company?.size)
    .build(),

  // Department information
  cb
    .text()
    .id('managedDepartments.name')
    .displayName('Manages Department')
    .nullableAccessor((user) => user.managedDepartments?.[0]?.name)
    .build(),
  cb
    .number()
    .id('managedDepartments.budget')
    .displayName('Dept Budget')
    .nullableAccessor((user) => user.managedDepartments?.[0]?.budget, 0)
    .build(),

  // Role information (many-to-many)
  cb
    .text()
    .id('roles.name')
    .displayName('Primary Role')
    .nullableAccessor((user) => user.userRoles?.[0]?.role?.name)
    .build(),
  cb
    .text()
    .id('roles.level')
    .displayName('Role Level')
    .nullableAccessor((user) => user.userRoles?.[0]?.role?.level)
    .build(),
  cb
    .number()
    .id('roles_count')
    .displayName('Role Count')
    .accessor((user) => user.userRoles?.length || 0)
    .build(),

  // Project information (many-to-many)
  cb
    .text()
    .id('userProjects.project.name')
    .displayName('Current Project')
    .nullableAccessor((user) => user.userProjects?.[0]?.project?.name)
    .build(),
  cb
    .text()
    .id('userProjects.role')
    .displayName('Project Role')
    .nullableAccessor((user) => user.userProjects?.[0]?.role)
    .build(),
  cb
    .number()
    .id('userProjects.hoursAllocated')
    .displayName('Hours Allocated')
    .nullableAccessor((user) => user.userProjects?.[0]?.hoursAllocated, 0)
    .build(),
  cb
    .number()
    .id('projects_count')
    .displayName('Project Count')
    .accessor((user) => user.userProjects?.length || 0)
    .build(),

  // Skills information (many-to-many)
  cb
    .text()
    .id('userSkills.skill.name')
    .displayName('Top Skill')
    .nullableAccessor((user) => user.userSkills?.[0]?.skill?.name)
    .build(),
  cb
    .text()
    .id('userSkills.proficiency')
    .displayName('Skill Level')
    .nullableAccessor((user) => user.userSkills?.[0]?.proficiency)
    .build(),
  cb
    .number()
    .id('userSkills.yearsExperience')
    .displayName('Experience Years')
    .nullableAccessor((user) => user.userSkills?.[0]?.yearsExperience, 0)
    .build(),
  cb
    .number()
    .id('skills_count')
    .displayName('Skills Count')
    .accessor((user) => user.userSkills?.length || 0)
    .build(),

  // Complex aggregations
  cb
    .number()
    .id('total_hours')
    .displayName('Total Hours')
    .accessor(
      (user) =>
        user.userProjects?.reduce(
          (sum: number, up: UserProject) => sum + (up.hoursAllocated || 0),
          0
        ) || 0
    )
    .build(),

  cb
    .number()
    .id('avg_experience')
    .displayName('Avg Experience')
    .accessor((user) => {
      const skills = user.userSkills || [];
      return skills.length > 0
        ? skills.reduce((sum: number, us: UserSkill) => sum + (us.yearsExperience || 0), 0) /
            skills.length
        : 0;
    })
    .build(),

  cb
    .number()
    .id('certified_skills')
    .displayName('Certified Skills')
    .accessor((user) => user.userSkills?.filter((us: UserSkill) => us.certified).length || 0)
    .build(),

  // Status indicators
  cb
    .boolean()
    .id('is_manager')
    .displayName('Is Manager')
    .accessor((user) => (user.managedDepartments?.length || 0) > 0)
    .build(),

  cb
    .boolean()
    .id('is_senior')
    .displayName('Is Senior')
    .accessor(
      (user) =>
        user.userRoles?.some(
          (ur: UserRole & { role?: Role }) =>
            ur.role?.level === 'senior' || ur.role?.level === 'lead'
        ) || false
    )
    .build(),

  cb
    .boolean()
    .id('has_active_projects')
    .displayName('Has Active Projects')
    .accessor(
      (user) =>
        user.userProjects?.some(
          (up: UserProject & { project?: Project }) => up.project?.status === 'active'
        ) || false
    )
    .build(),

  // Custom calculated fields
  cb
    .text()
    .id('skill_summary')
    .displayName('Skills')
    .accessor((user) => {
      const skills = user.userSkills || [];
      const topSkills =
        skills
          .sort((a: UserSkill, b: UserSkill) => (b.yearsExperience || 0) - (a.yearsExperience || 0))
          .slice(0, 3)
          .map((us) => `${us.skill?.name} (${us.proficiency})`)
          .join(', ') || 'No skills';
      return topSkills || 'No skills';
    })
    .build(),

  cb
    .text()
    .id('role_summary')
    .displayName('Roles')
    .accessor((user) => {
      const roles = user.userRoles || [];
      return (
        roles
          .map((ur: UserRole & { role?: Role }) => `${ur.role?.name} (${ur.role?.level})`)
          .join(', ') || 'No roles'
      );
    })
    .build(),

  cb
    .text()
    .id('project_summary')
    .displayName('Projects')
    .accessor((user) => {
      const projects = user.userProjects || [];
      const activeProjects = projects.filter(
        (up: UserProject & { project?: Project }) => up.project?.status === 'active'
      );
      return activeProjects.length > 0
        ? activeProjects
            .map((up: UserProject & { project?: Project }) => up.project?.name)
            .join(', ')
        : 'No active projects';
    })
    .build(),
];

// Custom relationship mappings for many-to-many
const customRelationships = {
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

async function setupComplexDatabase() {
  const sqlite = new Database(':memory:');
  const db: any = drizzle(sqlite);

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

async function createAdvancedAdapter(): Promise<any> {
  const { db, sqlite } = await setupComplexDatabase();

  const adapter = new DrizzleAdapter({
    db,
    schema,
    mainTable: 'users',
    driver: 'sqlite',
    autoDetectRelationships: false, // Use custom mappings
    relationships: customRelationships as RelationshipMap,
    options: {
      cache: {
        enabled: true,
        ttl: 600000, // 10 minutes
        maxSize: 2000,
      },
      optimization: {
        maxJoins: 8, // Allow more joins for complex relationships
        enableBatching: true,
        batchSize: 500,
      },
      logging: {
        enabled: true,
        level: 'debug',
        logQueries: true,
      },
      performance: {
        trackTiming: true,
        maxQueryTime: 10000,
      },
    },
  });

  return { adapter, sqlite };
}

async function runAdvancedExamples() {
  const { adapter, sqlite } = await createAdvancedAdapter();

  console.log('🚀 Advanced Drizzle Adapter Examples\n');

  // 1. Complex filtering with multiple relationships
  console.log('1. Senior developers with active projects:');
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
  console.log(`   Found ${seniorDevsResult.data.length} senior developers with active projects`);
  seniorDevsResult.data.forEach((user: UserWithComputed) => {
    console.log(`   - ${user.name}: ${user.total_hours} hours, ${user.skills_count} skills`);
  });
  console.log();

  // 2. Cross-company analysis
  console.log('2. Users by company and industry:');
  const companyResult = await adapter.fetchData({
    columns: ['name', 'company.name', 'company.industry', 'company.size'],
    sorting: [{ columnId: 'company.name', direction: 'asc' }],
  });
  console.log(`   Users by company:`);
  companyResult.data.forEach((user: UserWithComputed) => {
    console.log(
      `   - ${user.name} at ${user.company?.name} (${user.company?.industry}, ${user.company?.size})`
    );
  });
  console.log();

  // 3. Skill analysis
  console.log('3. Users with certified skills:');
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
  console.log(`   Users with certifications:`);
  certifiedResult.data.forEach((user: UserWithComputed) => {
    console.log(
      `   - ${user.name}: ${user.certified_skills} certified skills, avg ${user.avg_experience?.toFixed(1)} years experience`
    );
  });
  console.log();

  // 4. Project workload analysis
  console.log('4. Project workload distribution:');
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
  console.log(`   Project workload:`);
  workloadResult.data.forEach((user: UserWithComputed) => {
    console.log(
      `   - ${user.name}: ${user.projects_count} projects, ${user.total_hours} hours, role: ${user.userProjects?.[0]?.role}`
    );
  });
  console.log();

  // 5. Role and skill correlation
  console.log('5. Role and skill analysis:');
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
  console.log(`   Role and skills:`);
  roleSkillResult.data.forEach((user: UserWithComputed) => {
    console.log(
      `   - ${user.name}: ${user.userRoles?.[0]?.role?.name} (${user.userRoles?.[0]?.role?.level}) - ${user.skill_summary}`
    );
  });
  console.log();

  // 6. Manager analysis
  console.log('6. Department managers:');
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
  console.log(`   Department managers:`);
  managerResult.data.forEach((user: UserWithComputed) => {
    console.log(
      `   - ${user.name} manages ${user.managedDepartments?.[0]?.name} (budget: $${user.managedDepartments?.[0]?.budget?.toLocaleString()})`
    );
  });
  console.log();

  // 7. Complex aggregation
  console.log('7. Company performance metrics:');
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

  console.log(`   Company metrics:`);
  companyStats.forEach((stats) => {
    console.log(
      `   - ${stats.name} (${stats.industry}, ${stats.size}): ${stats.userCount} users, ${stats.totalSkills} skills, ${stats.totalProjects} projects`
    );
  });
  console.log();

  // 8. Performance analysis
  console.log('8. Performance metrics:');
  const perfResult = await adapter.fetchData({
    columns: ['name', 'company.name', 'roles.name', 'skill_summary', 'project_summary'],
    sorting: [{ columnId: 'name', direction: 'asc' }],
  });
  console.log(`   Query executed in ${perfResult.meta?.executionTime}ms`);
  console.log(`   Joins used: ${perfResult.meta?.joinCount}`);
  console.log(`   Records returned: ${perfResult.data.length}`);
  console.log();

  // 9. Export complex data
  console.log('9. Exporting complex organizational data:');
  const exportResult = await adapter.exportData({
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
  console.log(`   Exported ${exportResult.filename} with ${exportResult.data.length} characters`);
  console.log();

  // Cleanup
  sqlite.close();
  console.log('✅ Advanced examples completed successfully!');
}

// Run examples
if (require.main === module) {
  runAdvancedExamples().catch(console.error);
}

export { createAdvancedAdapter, columns, schema, relationsSchema, customRelationships };
