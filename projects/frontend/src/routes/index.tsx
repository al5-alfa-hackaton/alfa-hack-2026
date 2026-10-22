import { createFileRoute } from "@tanstack/react-router";
import { DemoApp } from "@/features/demo/app";

export const Route = createFileRoute("/")({ component: DemoApp });
