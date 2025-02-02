import { Plugin, Notice, TFile } from "obsidian";
import yaml from "js-yaml";

export default class ObsidianOMGPlugin extends Plugin {
	async onload() {
		console.log("Obsidian OMG Plugin loaded!");

		this.addCommand({
			id: "fix-frontmatter",
			name: "Fix Frontmatter in Current File",
			callback: () => this.fixFrontmatter(),
		});

		this.addCommand({
			id: "fix-all-frontmatter",
			name: "Fix Frontmatter in the WHOLE VAULT!!",
			callback: () => this.fixAllFrontmatter(),
		});
	}

	async fixFrontmatter() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file found.");
			return;
		}

		try {
			const content = await this.app.vault.read(activeFile);
			const updatedContent = this.modifyFrontmatter(activeFile, content);

			if (updatedContent) {
				await this.app.vault.modify(activeFile, updatedContent);
				new Notice("Frontmatter updated successfully!");
			} else {
				new Notice("No frontmatter found to update.");
			}
		} catch (error) {
			new Notice("Failed to update frontmatter.");
		}
	}

	async fixAllFrontmatter() {
		const files = this.app.vault.getFiles();

		let count = 0;

		// Iterate through each file
		for (const file of files) {
			// Check if the file is a markdown file
			if (file.extension === "md") {
				try {
					const content = await this.app.vault.read(file);
					const updatedContent = this.modifyFrontmatter(
						file,
						content,
					);

					if (updatedContent) {
						await this.app.vault.modify(file, updatedContent);
						count += 1;
					}
				} catch (error) {
					new Notice(
						`Failed to update frontmatter for ${file.name}.`,
					);
					break;
				}
			}
		}

		new Notice(`Update frontmatter for ${count} files.`);
	}

	modifyFrontmatter(file: TFile, content: string): string | null {
		const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
		if (!match) return null;

		let frontmatter = match[1];
		const body = content.replace(match[0], ""); // Remove old frontmatter

		try {
			// Parse YAML into an object
			const parsedData = yaml.load(frontmatter) as Record<string, any>;

			parsedData.link = this.fixFrontmatterLinks(
				this.getStringListIfNot(parsedData.link),
			);
			parsedData.tags = this.getStringListIfNot(parsedData.tags);

			// Remove unwanted entry
			const toRemoveList: string[] = [
				"reviewed",
				"publish",
				"review-frequency",
			];
			toRemoveList.forEach((item) => {
				if (parsedData[item] !== undefined) {
					delete parsedData[item];
				}
			});

			// Ensure aliases entry exist or set to file title
			if (parsedData["aliases"] !== undefined) {
				parsedData["aliases"] = file.name;
			}

			// Convert back to YAML string
			const newFrontmatter = yaml.dump(parsedData);

			// Reconstruct file content with updated frontmatter
			return `---\n${newFrontmatter}---\n${body}`;
		} catch (error) {
			console.error("Error parsing YAML:", error);
			return null;
		}
	}

	// If entry is a string type, it is probably a single item we should convert it to a list
	getStringListIfNot(entry: string[] | string) {
		if (typeof entry === "string") {
			const newList: string[] = [entry];
			return newList;
		}
		return entry;
	}

	fixFrontmatterLinks(links: string[]) {
		let newLinks: string[] = [];
		links.forEach((link) => {
			const match = link.match(/^\[\[(.*)\]\]$/);
			const linkName = match ? match[1].trim() : link.trim();
			const newLinkName =
				linkName.charAt(0).toUpperCase() + linkName.slice(1);

			// Make sure link is converted to an internal link
			newLinks.push(`[[${newLinkName}]]`);
		});
		return newLinks;
	}
}
