# Security Policy

## Reporting Security Vulnerabilities

We take the security of BGTM seriously. If you discover a security vulnerability, please report it to us privately.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please contact directly.

Include the following information:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (if you have them)

### Response Timeline

- We will acknowledge receipt of your vulnerability report within 48 hours
- We will provide a detailed response within 7 days indicating next steps
- We will notify you when the vulnerability has been fixed

### Disclosure Policy

- We ask that you do not publicly disclose the vulnerability until we have had a chance to fix it
- We will credit you for the discovery (if you wish) when we publicly announce the fix
- We may ask you to participate in validation testing of the fix

## Security Considerations

### Process Execution

BGTM executes user-provided commands as background processes. Users should be aware that:

- Commands are executed with the same privileges as the user running BGTM
- Input validation is performed, but users should be cautious with command injection
- Log files may contain sensitive information from command output

### Data Storage

BGTM stores process metadata in the user's home directory:

- Process information is stored in JSON format
- Log files contain command output
- No passwords or sensitive credentials are stored by BGTM itself

### Autostart Security

When using the autostart feature:

- Windows: Creates scheduled tasks with user privileges
- macOS: Creates launch agents in user space
- Linux: Creates systemd user services or XDG autostart entries

These integrations use standard platform mechanisms and run with user privileges.

## Best Practices for Users

1. **Command Validation**: Always validate commands before running them with BGTM
2. **Log Security**: Be aware that log files may contain sensitive output
3. **Autostart Review**: Regularly review autostart processes
4. **Access Control**: Ensure proper file permissions on the BGTM data directory
5. **Regular Updates**: Keep BGTM updated to the latest version

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✔️ |

## Security Features

- Input sanitization for commands
- Platform-specific process isolation
- User-space execution (no root/admin privileges required)
- Secure file permissions on data directories
- Safe process termination methods
