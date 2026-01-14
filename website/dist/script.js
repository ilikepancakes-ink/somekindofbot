"use strict";
class FeatureAnimator {
    constructor() {
        this.contextMenu = null;
        this.isMenuOpen = false;
        this.featureData = {
            moderation: {
                title: 'Moderation Commands',
                description: 'Keep your server safe with powerful moderation tools.',
                commands: ['/kick', '/ban', '/timeout', '/log', '/update', '/snipe']
            },
            fun: {
                title: 'Fun Commands',
                description: 'Add entertainment to your server with fun interactions.',
                commands: ['/joke', '/meme', '/roblox']
            },
            info: {
                title: 'Info Commands',
                description: 'Get detailed information about users, servers, and systems.',
                commands: ['/help', '/serverinfo', '/userinfo', '/statlist', '/system']
            },
            tickets: {
                title: 'Ticket System',
                description: 'Handle support requests efficiently with the ticket system.',
                commands: ['/ticket']
            },
            welcome: {
                title: 'Welcome Messages',
                description: 'Automatically greet new members and say goodbye.',
                commands: ['/welcome', '/goodbye']
            },
            dashboard: {
                title: 'Management Dashboard',
                description: 'Manage your bot through a user-friendly web interface and generate tokens.',
                commands: ['/generate-token']
            }
        };
        this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
            threshold: 0.1
        });
        this.init();
    }
    init() {
        const features = document.querySelectorAll('.feature');
        features.forEach(feature => {
            this.observer.observe(feature);
            feature.addEventListener('click', this.handleFeatureClick.bind(this));
        });
        this.addHoverEffects();
        this.createContextMenu();
    }
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }
    addHoverEffects() {
        const features = document.querySelectorAll('.feature');
        features.forEach(feature => {
            feature.addEventListener('mouseenter', () => {
                this.createParticles(feature);
            });
        });
    }
    createParticles(element) {
        for (let i = 0; i < 5; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            element.appendChild(particle);
            setTimeout(() => {
                particle.remove();
            }, 1000);
        }
    }
    createContextMenu() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'context-menu';
        this.contextMenu.innerHTML = `
            <div class="context-menu-content">
                <div class="context-menu-header">
                    <h3></h3>
                    <button class="close-btn">&times;</button>
                </div>
                <p class="context-description"></p>
                <div class="commands-list">
                    <h4>Available Commands:</h4>
                    <div class="commands"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.contextMenu);
        // Close menu when clicking outside or on close button
        this.contextMenu.addEventListener('click', (e) => {
            const closeBtn = this.contextMenu.querySelector('.close-btn');
            if (e.target === this.contextMenu || e.target === closeBtn) {
                this.closeContextMenu();
            }
        });
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMenuOpen) {
                this.closeContextMenu();
            }
        });
    }
    handleFeatureClick(event) {
        const feature = event.currentTarget;
        const featureId = feature.id;
        const data = this.featureData[featureId];
        if (data && this.contextMenu) {
            this.openContextMenu(data);
        }
    }
    openContextMenu(data) {
        if (!this.contextMenu)
            return;
        const header = this.contextMenu.querySelector('.context-menu-header h3');
        const description = this.contextMenu.querySelector('.context-description');
        const commandsDiv = this.contextMenu.querySelector('.commands');
        header.textContent = data.title;
        description.textContent = data.description;
        commandsDiv.innerHTML = data.commands.length > 0
            ? data.commands.map(cmd => `<span class="command-tag">${cmd}</span>`).join('')
            : '<em>No specific commands - Web interface</em>';
        this.contextMenu.classList.add('active');
        this.isMenuOpen = true;
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
    closeContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.classList.remove('active');
            this.isMenuOpen = false;
            document.body.style.overflow = '';
        }
    }
}
// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FeatureAnimator();
});
