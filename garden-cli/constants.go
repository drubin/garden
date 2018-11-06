package main

// These need to be var so we can inject them at compile time see .circleci/config.yml
var (
	// SyncImage is which docker image to use for syncing
	SyncImage = "gardenengine/garden-sync:latest"
	// ServiceImage is which docker image to use for garden service
	ServiceImage = "gardenengine/garden-service:latest"
	// ProjectPath is where to find the code inside ServiceImage
	ProjectPath = "/project"
	// Version is the compiled version
	Version = "0.0.1-dev-git"
	// Commit is the commit that this was built from
	Commit = "dirty-hash"
)
