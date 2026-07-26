import { exec } from "child_process";
import logger from "../shared/logger";

/**
 * Runs a Docker container using child_process.exec.
 * @param image The name of the Docker image to run.
 * @param args Arguments to pass to the container entrypoint.
 * @param mounts Volume mount bindings.
 * @returns A promise that resolves with the container standard output.
 */
export async function runDockerContainer(
  image: string,
  args: string[],
  mounts: { hostPath: string; containerPath: string }[] = []
): Promise<string> {
  const mountArgs = mounts
    .map((m) => `-v "${m.hostPath}:${m.containerPath}"`)
    .join(" ");

  // Escape double quotes in arguments
  const escapedArgs = args
    .map((arg) => `"${arg.replace(/"/g, '\\"')}"`)
    .join(" ");

  const command = `docker run --rm ${mountArgs} ${image} ${escapedArgs}`;
  logger.info(`Spawning container: ${image} with args: ${args.join(" ")}`);

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (stderr && stderr.trim()) {
        logger.debug(`[Container Stderr] ${stderr.trim()}`);
      }
      if (error) {
        logger.error(`Container execution failed: ${error.message}`);
        reject(error);
      } else {
        logger.info("Container finished successfully.");
        resolve(stdout);
      }
    });
  });
}
