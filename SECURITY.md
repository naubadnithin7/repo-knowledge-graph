# Security review (alpha)

The scanner does not execute source or persist source content. It excludes common secret filenames and recognizable credential patterns; this is not comprehensive secret detection. Context reads reject symlinks and path escapes. External embedding/model adapters may transmit source. Known limitations include partial gitignore support, TOCTOU race, incomplete secret detection, and no independent penetration test. Never commit `.repo-graph/`.


## MCP security boundaries

The MCP server is local and uses stdio, not a network listener. It reads repository files to answer queries and refreshes the on-disk index when files change. Context responses include source snippets; connecting an AI assistant may cause those snippets to be sent to the assistant's model provider. Restrict the working directory to the intended repository, and avoid indexing sensitive source. The server does not execute repository code. Gitignore parsing covers common patterns but is not fully equivalent to Git's nested ignore behavior. Changes between scan and context read are rejected by a content-hash check; this is not a substitute for OS-level access controls.
