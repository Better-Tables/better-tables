import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { NextIcon } from "@/components/icons/next-icon";
import { ReactIcon } from "@/components/icons/react-icon";
import { InstallBlock } from "@/components/install-block";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    InstallBlock,
    NextIcon,
    ReactIcon,
    ...components,
  };
}
