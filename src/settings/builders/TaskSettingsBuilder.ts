import { Setting, SettingGroup } from 'obsidian';
import { BaseBuilder } from './BaseBuilder';
import { FolderSuggest, TaskStatusCard } from '../components';
import { AddCustomStatusModal } from '../modals';
import type { BuilderConfig } from '../types';
import type { TaskStatus } from '../../tasks/taskStatus';

/**
 * 任务设置构建器
 * 包含任务创建设置和任务状态设置
 */
export class TaskSettingsBuilder extends BaseBuilder {
	constructor(config: BuilderConfig) {
		super(config);
	}

	render(): void {
		// 统一添加设置项的辅助方法
		const addSetting = (group: SettingGroup | HTMLElement, cb: (setting: Setting) => void) => {
			if (this.isSettingGroupAvailable()) {
				(group as SettingGroup).addSetting(cb);
			} else {
				cb(new Setting(this.containerEl));
			}
		};

		// ===== 任务设置（主组） =====
		this.createSettingGroup('任务设置', (group) => {
			// ========== 基础设置 ==========

			// 全局任务筛选标记
			addSetting(group, setting =>
				setting.setName('全局任务筛选标记(修改此设置后需重启 Obsidian 生效)')
					.setDesc('用于标记任务的前缀符号或文字（如 "🎯 ", "TODO ", "#task "）')
					.addText(text => text
						.setPlaceholder('空则不使用筛选')
						.setValue(this.plugin.settings.globalTaskFilter)
						.onChange(async (value) => {
							this.plugin.settings.globalTaskFilter = value.trim();
							await this.saveAndRefresh();
						}))
			);

			// 启用的任务格式
			addSetting(group, setting => {
				setting.setName('启用的任务格式')
					.setDesc('选择要支持的任务格式（Tasks 插件或 Dataview 插件）')
					.addDropdown(drop => {
						drop.addOptions({
							'tasks': 'Tasks 插件格式（使用 emoji 表示日期）',
							'dataview': 'Dataview 插件格式（使用字段表示日期）',
							'both': '两者都支持',
						});

						const formats = this.plugin.settings.enabledTaskFormats;
						if (formats.includes('tasks') && formats.includes('dataview')) drop.setValue('both');
						else if (formats.includes('tasks')) drop.setValue('tasks');
						else if (formats.includes('dataview')) drop.setValue('dataview');

						drop.onChange(async (value) => {
							this.plugin.settings.enabledTaskFormats = (value === 'both') ? ['tasks', 'dataview'] : [value];
							await this.saveAndRefresh();
						});
					});
			});

			// 任务文本是否显示 Global Filter
			addSetting(group, setting =>
				setting.setName('任务文本显示 Global Filter')
					.setDesc('在任务列表中文本前显示全局筛选前缀（如 🎯）。关闭则仅显示任务描述. 修改全局筛选器后可能会有显示错误,需要关闭再打开此选项一次')
					.addToggle(toggle => toggle
						.setValue(this.plugin.settings.showGlobalFilterInTaskText)
						.onChange(async (value) => {
							this.plugin.settings.showGlobalFilterInTaskText = value;
							await this.saveAndRefresh();
						}))
			);

			// 任务笔记文件夹路径
			addSetting(group, setting =>
				setting.setName('任务笔记文件夹路径')
					.setDesc('从任务创建笔记时的默认存放路径（相对于库根目录）')
					.addSearch(cb => {
						new FolderSuggest(this.plugin.app, cb.inputEl);
						cb.setPlaceholder('Example: Tasks')
							.setValue(this.plugin.settings.taskNotePath)
							.onChange(async (value) => {
								const trimmed = value.trim().replace(/\/$/, '');
								this.plugin.settings.taskNotePath = trimmed;
								await this.plugin.saveSettings();
							});
					})
			);

			// ========== 任务创建设置（子组） ==========
			addSetting(group, setting => {
				setting.setName('任务创建设置')
					.setDesc('配置创建新任务时的默认行为');
				setting.controlEl.remove();

				// 创建子设置容器
				const subSettingContainer = setting.settingEl.createDiv('task-subsetting-container');
				subSettingContainer.style.marginTop = '12px';
				subSettingContainer.style.display = 'flex';
				subSettingContainer.style.flexDirection = 'column';
				subSettingContainer.style.gap = '12px';

				// 新任务标题
				const newTaskHeading = new Setting(subSettingContainer);
				newTaskHeading.setName('新任务所在标题')
					.setDesc('在 Daily Note 中添加新任务时的目标标题（留空则添加到文件末尾）')
					.addText(text => text
						.setPlaceholder('例如：## 工作任务')
						.setValue(this.plugin.settings.newTaskHeading || '')
						.onChange(async (value) => {
							this.plugin.settings.newTaskHeading = value || undefined;
							await this.plugin.saveSettings();
						}));

				// Templater 集成
				const templaterToggle = new Setting(subSettingContainer);
				templaterToggle.setName('启用 Templater 集成(此功能待完善)')
					.setDesc('创建 Daily Note 时使用 Templater 插件的模板（需安装 Templater）')
					.addToggle(toggle => toggle
						.setValue(this.plugin.settings.enableTemplaterForDailyNote || false)
						.onChange(async (value) => {
							this.plugin.settings.enableTemplaterForDailyNote = value;
							await this.plugin.saveSettings();
							// 刷新显示关联设置
							this.plugin.refreshCalendarViews();
						}));

				// Templater 模板路径（条件渲染）
				if (this.plugin.settings.enableTemplaterForDailyNote) {
					const templaterPath = new Setting(subSettingContainer);
					templaterPath.setName('Templater 模板路径')
						.setDesc('指定用于创建 Daily Note 的模板文件路径')
						.addText(text => text
							.setPlaceholder('Templates/Daily Note Template.md')
							.setValue(this.plugin.settings.templaterTemplatePath || '')
							.onChange(async (value) => {
								this.plugin.settings.templaterTemplatePath = value;
								await this.plugin.saveSettings();
							}));
				}

				// 默认优先级
				const defaultPriority = new Setting(subSettingContainer);
				defaultPriority.setName('默认任务优先级')
					.setDesc('创建新任务时的默认优先级')
					.addDropdown(drop => drop
						.addOptions({
							'highest': '🔺 最高',
							'high': '⏫ 高',
							'medium': '🔼 中',
							'low': '🔽 低',
							'lowest': '⏬ 最低',
							'normal': '无',
						})
						.setValue(this.plugin.settings.defaultTaskPriority || 'medium')
						.onChange(async (value) => {
							this.plugin.settings.defaultTaskPriority = value as any;
							await this.plugin.saveSettings();
						}));
			});

			// ========== 任务默认状态设置（子组） ==========
			addSetting(group, setting => {
				setting.nameEl.remove();
				setting.descEl.remove();
				setting.controlEl.remove();
				setting.infoEl.style.flex = '0';
				setting.infoEl.style.minWidth = '0';
				setting.infoEl.style.padding = '0';

				// 创建容器（参考热力图色卡设计）
				const settingDiv = setting.settingEl.createDiv('task-status-setting');

				// 标题区域
				const labelDiv = settingDiv.createDiv('task-status-label');
				labelDiv.createEl('div', { text: '任务默认状态设置', cls: 'task-status-name' });
				labelDiv.createEl('div', { text: '配置任务中默认状态的颜色和样式', cls: 'task-status-desc' });

				// 创建网格容器用于放置所有状态卡片
				const gridContainer = settingDiv.createDiv('task-status-cards-grid');
				gridContainer.style.display = 'grid';
				gridContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
				gridContainer.style.gap = '12px';

				// 从设置中获取默认状态
				const defaultStatuses = this.plugin.settings.taskStatuses.filter((s: TaskStatus) => s.isDefault);
				defaultStatuses.forEach((status: TaskStatus) => {
					const card = new TaskStatusCard({
						container: gridContainer,
						plugin: this.plugin,
						status: status
					});
					card.render();
				});
			});

			// ========== 任务自定义状态设置（子组） ==========
			addSetting(group, setting => {
				setting.nameEl.remove();
				setting.descEl.remove();
				setting.controlEl.remove();
				setting.infoEl.style.flex = '0';
				setting.infoEl.style.minWidth = '0';
				setting.infoEl.style.padding = '0';

				// 创建容器（参考热力图色卡设计）
				const settingDiv = setting.settingEl.createDiv('task-status-setting');

				// 标题区域
				const labelDiv = settingDiv.createDiv('task-status-label');
				labelDiv.createEl('div', { text: '任务自定义状态设置', cls: 'task-status-name' });
				labelDiv.createEl('div', { text: '配置任务自定义状态的颜色和样式。最多支持 3 个自定义状态。', cls: 'task-status-desc' });

				// 创建子设置容器
				const subSettingContainer = settingDiv.createDiv('task-subsetting-container');
				subSettingContainer.style.display = 'flex';
				subSettingContainer.style.flexDirection = 'column';
				subSettingContainer.style.gap = '12px';

				// 获取自定义状态数量
				const customStatuses = this.plugin.settings.taskStatuses.filter((s: TaskStatus) => !s.isDefault);
				const customCount = customStatuses.length;
				const maxCustom = 3;

				// 添加自定义状态按钮
				if (customCount < maxCustom) {
					const addSetting = new Setting(subSettingContainer);
					addSetting.setName('添加自定义状态')
						.setDesc(`创建一个新的任务状态（已添加 ${customCount}/${maxCustom} 个自定义状态）`)
						.addButton(button => button
							.setButtonText('添加')
							.setCta()
							.onClick(() => {
								this.showAddCustomStatusModal();
							}));
				}

				// 渲染现有自定义状态（使用网格容器）
				if (customStatuses.length > 0) {
					const gridContainer = subSettingContainer.createDiv('task-status-cards-grid');
					gridContainer.style.display = 'grid';
					gridContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
					gridContainer.style.gap = '12px';

					customStatuses.forEach((status: TaskStatus) => {
						const card = new TaskStatusCard({
							container: gridContainer,
							plugin: this.plugin,
							status: status,
							onDelete: async () => {
								// 删除自定义状态
								this.plugin.settings.taskStatuses = this.plugin.settings.taskStatuses.filter((s: TaskStatus) => s.key !== status.key);
								await this.saveAndRefresh();
								// 刷新设置面板以反映变更
								this.refreshSettingsPanel();
							}
						});
						card.render();
					});
				}
			});
		});
	}

	/**
	 * 显示添加自定义状态模态框
	 */
	private showAddCustomStatusModal(): void {
		const modal = new AddCustomStatusModal(this.plugin.app, this.plugin, () => {
			// 添加状态成功后刷新设置面板
			this.refreshSettingsPanel();
		});
		modal.open();
	}
}
