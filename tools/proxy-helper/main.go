package main

import (
	"context"
	"fmt"
	"os"

	"github.com/castai/cheap/tools/proxy-helper/cmd/proxy"
	"github.com/spf13/cobra"
)

// NewRootCmd builds and returns the root cobra command.
func NewRootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:           "cheap-ssh-proxy",
		Short:         "Cheap SSH proxy helper",
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.AddCommand(proxy.NewSSHProxyCmd())
	return root
}

func main() {
	if err := NewRootCmd().ExecuteContext(context.Background()); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
