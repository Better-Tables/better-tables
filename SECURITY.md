# Security Policy

## Supported Versions

We actively support the following versions of Better Tables with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.5.x   | Yes |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do NOT** open a public issue

Security vulnerabilities should be reported privately to prevent exploitation.

### 2. Report via GitHub Security Advisories

The preferred method is to use GitHub's private security advisory system:

1. Go to [Security Advisories](https://github.com/Better-Tables/better-tables/security/advisories/new)
2. Click "Report a vulnerability"
3. Fill out the form with details about the vulnerability

### 3. What to Include

Please provide as much information as possible:

- **Description**: Clear description of the vulnerability
- **Impact**: What could an attacker do with this vulnerability?
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Affected Versions**: Which versions are affected?
- **Suggested Fix**: If you have ideas for a fix, please share them

### 4. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity, but we aim for timely fixes

### 5. Disclosure Policy

- We will acknowledge receipt of your report within 48 hours
- We will keep you informed of our progress
- We will notify you when the vulnerability is fixed
- We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

When using Better Tables:

- **Keep dependencies updated**: Regularly update `@better-tables/core`, `@better-tables/ui`, and adapters
- **Review access controls**: Ensure proper authentication and authorization in your applications
- **Validate input**: Always validate and sanitize user input before passing to table components
- **Use HTTPS**: Always use HTTPS in production environments
- **Follow principle of least privilege**: Grant minimum necessary permissions

## Security Features

Better Tables includes several security features:

- **Input validation**: Built-in validation for filter values and operators
- **SQL injection protection**: Adapters use parameterized queries
- **XSS prevention**: UI components sanitize output
- **Type safety**: TypeScript helps prevent many security issues

## Questions?

If you have questions about security in Better Tables, please:

- Open a [Discussion](https://github.com/Better-Tables/better-tables/discussions)
- Check our [Documentation](https://github.com/Better-Tables/better-tables/tree/main/docs)

Thank you for helping keep Better Tables secure! 🔒

