# Security review (alpha)

The scanner does not execute source or persist source content. It excludes common secret filenames and recognizable credential patterns; this is not comprehensive secret detection. Context reads reject symlinks and path escapes. External embedding/model adapters may transmit source. Known limitations include partial gitignore support, TOCTOU race, incomplete secret detection, and no independent penetration test. Never commit `.repo-graph/`.
