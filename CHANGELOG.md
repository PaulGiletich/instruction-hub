# Changelog

## [1.3.0] - 2025-10-03

### Added
- Direct URL installation support: You can now install instructions directly from a GitHub URL
  - Example: `ih add https://github.com/owner/repo/blob/main/path/to/file.md`
  - Automatically adds the repository to config if not already present
  - Downloads and installs the instruction file immediately
- New functions in `github.ts`:
  - `parseGitHubFileUrl()` - Parses GitHub file URLs to extract repo and file information
  - `fetchSingleFile()` - Fetches a specific file from GitHub
- New function in `interactive.ts`:
  - `installFromUrl()` - Handles direct URL installation with automatic repo addition

### Changed
- `install`/`add` command now accepts an optional URL parameter
  - Without URL: runs interactive mode (existing behavior)
  - With URL: directly installs from the provided GitHub file URL
